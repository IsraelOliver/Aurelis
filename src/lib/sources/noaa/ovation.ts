import type { AuroraForecastFeed, AuroraGridCell } from "@/types";
import { NOAA_SWPC_OVATION_SOURCE, NOAA_SWPC_OVATION_URL } from "./source";

/**
 * NOAA SWPC OVATION aurora adapter: the only place that knows its JSON format.
 * Product: https://www.swpc.noaa.gov/products/aurora-30-minute-forecast
 * ("short-term forecast of the location and intensity of the aurora", OVATION
 * model, 30–90 min lead time). Public, no key. Payload:
 * { "Observation Time", "Forecast Time", "Data Format", coordinates: [[lon, lat, aurora], …], type }.
 */

/** Column order this adapter relies on; any other format is rejected. */
const EXPECTED_DATA_FORMAT = "[Longitude, Latitude, Aurora]";

/** Times must carry an explicit zone (they do today: "…Z"); none is ever assumed. */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export async function fetchAuroraForecast(): Promise<AuroraForecastFeed> {
  const response = await fetch(NOAA_SWPC_OVATION_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`NOAA SWPC OVATION responded ${response.status}`);
  }
  const payload: unknown = await response.json();
  return normalizeAuroraForecast(payload, new Date().toISOString());
}

function parseZonedTime(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid "${field}"`);
  }
  return new Date(value).toISOString();
}

/**
 * Source longitude is 0..359 (east). AURELIS uses −180..180: lon > 180 → lon − 360.
 * A cartographic transformation of the same position; the data does not change.
 */
export function normalizeLongitude(lon: number): number {
  return lon > 180 ? lon - 360 : lon;
}

export function normalizeAuroraForecast(payload: unknown, ingestedAt: string): AuroraForecastFeed {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("OVATION payload is not an object");
  }
  const p = payload as Record<string, unknown>;
  const inputObservationTime = parseZonedTime(p["Observation Time"], "Observation Time");
  const forecastTime = parseZonedTime(p["Forecast Time"], "Forecast Time");
  const dataFormat = p["Data Format"];
  if (dataFormat !== EXPECTED_DATA_FORMAT) {
    throw new Error(`Unexpected "Data Format": ${String(dataFormat)}`);
  }
  if (!Array.isArray(p.coordinates)) throw new Error("OVATION coordinates is not an array");

  const seen = new Set<string>();
  const activeCells: AuroraGridCell[] = [];
  let total = 0;
  let rejected = 0;
  let peak = 0;
  for (const cell of p.coordinates as unknown[]) {
    if (
      !Array.isArray(cell) ||
      cell.length !== 3 ||
      !cell.every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      rejected++;
      continue;
    }
    const [lon, lat, value] = cell as [number, number, number];
    // Source domain: longitude 0..359 (accepted up to < 360), latitude −90..90, value ≥ 0.
    // No upper bound on the value: none is documented.
    if (lon < 0 || lon >= 360 || lat < -90 || lat > 90 || value < 0) {
      rejected++;
      continue;
    }
    const key = `${lon},${lat}`;
    if (seen.has(key)) {
      rejected++;
      continue;
    }
    seen.add(key);
    total++;
    if (value > peak) peak = value;
    if (value > 0) activeCells.push([normalizeLongitude(lon), lat, value]);
  }
  if (total === 0) throw new Error("OVATION payload has no valid grid cell");

  return {
    source: NOAA_SWPC_OVATION_SOURCE,
    observation: {
      id: `${NOAA_SWPC_OVATION_SOURCE.id}:${forecastTime}`,
      // One forecast snapshot of a continuous field: no entity and no single location.
      sourceId: NOAA_SWPC_OVATION_SOURCE.id,
      nature: "forecast",
      confidence: "unknown",
      // "Observation Time" is not an observation of the aurora and its meaning is not
      // documented for this JSON: kept in data.inputObservationTime, not as observedAt.
      validAt: forecastTime,
      ingestedAt,
      data: {
        inputObservationTime,
        forecastTime,
        dataFormat,
        totalGridCells: total,
        activeGridCells: activeCells.length,
        rejectedGridCells: rejected,
        peakValue: peak,
        activeCells,
      },
      sourceRecordId: forecastTime,
      // No per-forecast URL exists: the "latest" endpoint.
      sourceUrl: NOAA_SWPC_OVATION_URL,
    },
    metadata: { ingestedAt },
  };
}
