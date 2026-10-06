import type { IntelligenceSource } from "@/types";

/** Static description of the Open-Meteo forecast source; safe to import in client code. */
export const OPEN_METEO_SOURCE: IntelligenceSource = {
  id: "open-meteo-weather",
  name: "Open-Meteo — Weather Forecast",
  provider: "Open-Meteo",
  category: "open-data",
  url: "https://open-meteo.com/",
  // No formal reliability methodology exists yet.
  reliability: "unknown",
  description:
    "Model-based point weather (Forecast API, Best Match) combining national weather service models; CC BY 4.0.",
};

export const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_LICENCE_URL = "https://open-meteo.com/en/licence";
export const CC_BY_4_URL = "https://creativecommons.org/licenses/by/4.0/";

export const WEATHER_FORECAST_HOURS = 24;

/** Valid query coordinate (finite, WGS84 range); null otherwise. */
export function parseQueryCoordinate(lat: unknown, lon: unknown): { latitude: number; longitude: number } | null {
  const latitude = typeof lat === "string" && lat.trim() !== "" ? Number(lat) : NaN;
  const longitude = typeof lon === "string" && lon.trim() !== "" ? Number(lon) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
