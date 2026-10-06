import type { GeoLocation, WeatherCurrentData, WeatherHourlyData, WeatherHourlyObservation, WeatherPointFeed } from "@/types";
import { isDocumentedWeatherCode } from "@/lib/weather-codes";
import { OPEN_METEO_FORECAST_URL, OPEN_METEO_SOURCE, WEATHER_FORECAST_HOURS } from "./source";

/**
 * Open-Meteo Forecast API adapter (the only place that knows its JSON format).
 * Docs: https://open-meteo.com/en/docs — free non-commercial use without a key,
 * data under CC BY 4.0 (attribution link shown next to the data).
 *
 * - Best Match (no `models` parameter): the API picks the model per location;
 *   the response does not say which one, so none is claimed.
 * - `current` = 15-minutely MODEL data (not a station): nature "estimated",
 *   validAt = current.time. Hourly values after current.time: nature
 *   "forecast", validAt = that hour; hourly values at or before current.time
 *   (the current hour) are model estimates too. Never observedAt/reportedAt.
 * - Timestamps: requested with timezone=UTC; the API returns local-time
 *   strings without offset for the requested zone and states
 *   utc_offset_seconds (must be 0), so they are read as UTC.
 * - Location: response latitude/longitude = centre of the grid cell used
 *   (may be km away from the requested point): precision "approximate".
 * - Units are the API defaults and are checked on every response; any other
 *   unit is rejected instead of being mislabeled.
 */

const CURRENT_FIELDS = {
  temperature_2m: ["temperatureC", "°C"],
  apparent_temperature: ["apparentTemperatureC", "°C"],
  relative_humidity_2m: ["relativeHumidityPercent", "%"],
  cloud_cover: ["cloudCoverPercent", "%"],
  precipitation: ["precipitationMm", "mm"],
  weather_code: ["weatherCode", "wmo code"],
  pressure_msl: ["pressureMslHpa", "hPa"],
  wind_speed_10m: ["windSpeedKmh", "km/h"],
  wind_direction_10m: ["windDirectionDegrees", "°"],
  wind_gusts_10m: ["windGustsKmh", "km/h"],
} as const satisfies Record<string, [keyof WeatherCurrentData, string]>;

const HOURLY_FIELDS = {
  temperature_2m: ["temperatureC", "°C"],
  cloud_cover: ["cloudCoverPercent", "%"],
  precipitation_probability: ["precipitationProbabilityPercent", "%"],
  precipitation: ["precipitationMm", "mm"],
  weather_code: ["weatherCode", "wmo code"],
  wind_speed_10m: ["windSpeedKmh", "km/h"],
} as const satisfies Record<string, [keyof WeatherHourlyData, string]>;

export function openMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: Object.keys(CURRENT_FIELDS).join(","),
    hourly: Object.keys(HOURLY_FIELDS).join(","),
    forecast_hours: String(WEATHER_FORECAST_HOURS),
    timezone: "UTC",
  });
  return `${OPEN_METEO_FORECAST_URL}?${params}`;
}

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** "2026-10-06T17:15" (UTC per utc_offset_seconds = 0) → ISO; throws when malformed. */
function utcTime(value: unknown, field: string): string {
  if (typeof value !== "string" || !LOCAL_TIME.test(value)) throw new Error(`Invalid ${field}`);
  const ms = Date.parse(`${value}Z`);
  if (!Number.isFinite(ms)) throw new Error(`Invalid ${field}`);
  return new Date(ms).toISOString();
}

/** A documented WMO code, or undefined (never an invented label). */
const weatherCode = (v: unknown) => {
  const n = finite(v);
  return n !== undefined && Number.isInteger(n) && isDocumentedWeatherCode(n) ? n : undefined;
};

export function normalizeOpenMeteo(
  payload: unknown,
  requested: { latitude: number; longitude: number },
  ingestedAt: string,
): WeatherPointFeed {
  if (!isObject(payload)) throw new Error("Open-Meteo payload is not an object");
  const p = payload;
  const lat = finite(p.latitude);
  const lon = finite(p.longitude);
  if (lat === undefined || lon === undefined || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Open-Meteo payload has no valid latitude/longitude");
  }
  if (p.utc_offset_seconds !== 0) throw new Error("Open-Meteo timestamps are not UTC");
  const { current, current_units: currentUnits, hourly, hourly_units: hourlyUnits } = p;
  if (!isObject(current) || !isObject(currentUnits) || !isObject(hourly) || !isObject(hourlyUnits)) {
    throw new Error("Open-Meteo payload lacks current/hourly blocks");
  }
  for (const [key, [, unit]] of Object.entries(CURRENT_FIELDS)) {
    if (currentUnits[key] !== unit) throw new Error(`Unexpected current unit for ${key}: ${String(currentUnits[key])}`);
  }
  for (const [key, [, unit]] of Object.entries(HOURLY_FIELDS)) {
    if (hourlyUnits[key] !== unit) throw new Error(`Unexpected hourly unit for ${key}: ${String(hourlyUnits[key])}`);
  }
  if (!Array.isArray(hourly.time)) throw new Error("Open-Meteo hourly.time is not an array");
  const n = hourly.time.length;
  for (const key of Object.keys(HOURLY_FIELDS)) {
    if (!Array.isArray(hourly[key]) || (hourly[key] as unknown[]).length !== n) {
      throw new Error(`Open-Meteo hourly.${key} missing or of a different length`);
    }
  }

  const gridLocation: GeoLocation = { latitude: lat, longitude: lon, precision: "approximate" };
  const key = `${OPEN_METEO_SOURCE.id}:${requested.latitude}:${requested.longitude}`;
  const sourceUrl = openMeteoUrl(requested.latitude, requested.longitude);

  const currentValidAt = utcTime(current.time, "current.time");
  const currentData: WeatherCurrentData = { intervalSeconds: finite(current.interval) };
  for (const [field, [name]] of Object.entries(CURRENT_FIELDS)) {
    const value = name === "weatherCode" ? weatherCode(current[field]) : finite(current[field]);
    if (value !== undefined) currentData[name] = value;
  }

  const hourlyObservations: WeatherHourlyObservation[] = [];
  for (let i = 0; i < n; i++) {
    const validAt = utcTime((hourly.time as unknown[])[i], `hourly.time[${i}]`);
    const data: WeatherHourlyData = {};
    for (const [field, [name]] of Object.entries(HOURLY_FIELDS)) {
      const raw = (hourly[field] as unknown[])[i];
      const value = name === "weatherCode" ? weatherCode(raw) : finite(raw);
      if (value !== undefined) data[name] = value;
    }
    hourlyObservations.push({
      id: `${key}:hourly:${validAt}`,
      sourceId: OPEN_METEO_SOURCE.id,
      // Future hours are forecasts; the current (already started) hour is a model estimate.
      nature: Date.parse(validAt) > Date.parse(currentValidAt) ? "forecast" : "estimated",
      confidence: "unknown",
      validAt,
      ingestedAt,
      location: gridLocation,
      data,
      sourceUrl,
    });
  }

  return {
    source: OPEN_METEO_SOURCE,
    requestedLocation: { latitude: requested.latitude, longitude: requested.longitude },
    gridCell: { latitude: lat, longitude: lon, elevationM: finite(p.elevation) },
    model: "best_match",
    current: {
      id: `${key}:current:${currentValidAt}`,
      sourceId: OPEN_METEO_SOURCE.id,
      nature: "estimated",
      confidence: "unknown",
      validAt: currentValidAt,
      ingestedAt,
      location: gridLocation,
      data: currentData,
      sourceUrl,
    },
    hourly: hourlyObservations,
    metadata: { ingestedAt, forecastHours: WEATHER_FORECAST_HOURS },
  };
}

export async function fetchOpenMeteoPoint(latitude: number, longitude: number): Promise<WeatherPointFeed> {
  const response = await fetch(openMeteoUrl(latitude, longitude), {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);
  return normalizeOpenMeteo(await response.json(), { latitude, longitude }, new Date().toISOString());
}
