import type { IssFeed, IssObservation } from "@/types";
import { ISS_ENTITY_ID, WTIA_ISS_SOURCE } from "./source";

/**
 * Where The ISS At? adapter: the only place that knows its JSON format.
 * Docs: https://wheretheiss.at/w/developer (no auth, ~1 request/s rate limit).
 */
const ISS_NORAD_ID = 25544;
const WTIA_ISS_URL = `https://api.wheretheiss.at/v1/satellites/${ISS_NORAD_ID}`;

/** Fetches the current ISS position and normalizes it. Throws on any invalid response. */
export async function fetchIssPosition(): Promise<IssFeed> {
  const response = await fetch(`${WTIA_ISS_URL}?units=kilometers`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Where The ISS At? responded ${response.status}`);
  }
  const payload: unknown = await response.json();
  return normalizeIssPosition(payload, new Date().toISOString());
}

export function normalizeIssPosition(payload: unknown, ingestedAt: string): IssFeed {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("ISS payload is not an object");
  }
  const p = payload as Record<string, unknown>;
  const { id, latitude, longitude, altitude, velocity, timestamp, units } = p;

  if (id !== ISS_NORAD_ID) throw new Error(`Unexpected satellite id: ${String(id)}`);
  if (units !== "kilometers") throw new Error(`Unexpected units: ${String(units)}`);
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude");
  }
  if (!isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude");
  }
  if (!isFiniteNumber(altitude) || altitude <= 0) throw new Error("Invalid altitude");
  if (!isFiniteNumber(velocity) || velocity <= 0) throw new Error("Invalid velocity");
  if (!isFiniteNumber(timestamp) || timestamp <= 0) throw new Error("Invalid timestamp");

  const location = {
    latitude,
    longitude,
    // Computed from orbital elements, not a direct GPS fix: never "exact".
    precision: "approximate" as const,
  };
  const observationId = `wtia:${ISS_NORAD_ID}:${timestamp}`;

  const observation: IssObservation = {
    id: observationId,
    entityId: ISS_ENTITY_ID,
    sourceId: WTIA_ISS_SOURCE.id,
    // The source computes the position orbitally; nobody observed it directly.
    nature: "estimated",
    confidence: "unknown",
    // Unix seconds: the instant the position applies to. No publication time exists (no reportedAt).
    observedAt: new Date(timestamp * 1000).toISOString(),
    ingestedAt,
    location,
    data: {
      noradId: ISS_NORAD_ID,
      altitudeKm: altitude,
      // Raw value; the source does not document its unit (see IssObservationData).
      velocity,
      velocityUnit: "unknown",
      visibility:
        typeof p.visibility === "string" && p.visibility !== "" ? p.visibility : undefined,
    },
    sourceRecordId: String(ISS_NORAD_ID),
    // Requesting this timestamp returns the same computed position: the record is reproducible.
    sourceUrl: `${WTIA_ISS_URL}?timestamp=${timestamp}&units=kilometers`,
  };

  return {
    source: WTIA_ISS_SOURCE,
    entities: [
      {
        id: ISS_ENTITY_ID,
        category: "space",
        kind: "space-station",
        label: "International Space Station",
        location,
        locationObservationId: observationId,
      },
    ],
    observations: [observation],
    metadata: { ingestedAt },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
