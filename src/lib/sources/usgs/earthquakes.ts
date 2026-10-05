import type {
  AurelisEntity,
  EarthquakeFeed,
  EarthquakeObservation,
} from "@/types";
import { USGS_EARTHQUAKES_SOURCE } from "./source";

/**
 * USGS adapter: the only place that knows the USGS GeoJSON Summary format.
 * Feed: M2.5+ earthquakes, past day. Updated every minute by USGS.
 * Format: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */
export const USGS_EARTHQUAKES_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

/** Fetches the feed and normalizes it. Throws if the feed as a whole is unusable. */
export async function fetchUsgsEarthquakes(): Promise<EarthquakeFeed> {
  const response = await fetch(USGS_EARTHQUAKES_FEED_URL, {
    // Caching is done one level up, on the normalized result (see the API route).
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`USGS feed responded ${response.status}`);
  }
  const payload: unknown = await response.json();
  return normalizeUsgsFeed(payload, new Date().toISOString());
}

export function normalizeUsgsFeed(
  payload: unknown,
  ingestedAt: string,
): EarthquakeFeed {
  if (!isRecord(payload) || payload.type !== "FeatureCollection") {
    throw new Error("USGS payload is not a GeoJSON FeatureCollection");
  }
  if (!Array.isArray(payload.features)) {
    throw new Error("USGS payload has no features array");
  }

  const entities: AurelisEntity[] = [];
  const observations: EarthquakeObservation[] = [];
  const seen = new Set<string>();
  let skippedRecords = 0;
  let excludedRecords = 0;

  for (const feature of payload.features) {
    const record = parseFeature(feature);
    if (record === "skip" || (record !== "exclude" && seen.has(record.id))) {
      skippedRecords++;
      continue;
    }
    if (record === "exclude") {
      excludedRecords++;
      continue;
    }
    seen.add(record.id);

    const entityId = `earthquake:usgs:${record.id}`;
    const observationId = `usgs:${record.id}:${record.updated}`;
    const observedAt = new Date(record.time).toISOString();
    const location = {
      latitude: record.latitude,
      longitude: record.longitude,
      // Computed from seismic data: never "exact". No uncertainty radius in the Summary feed.
      precision: "approximate" as const,
    };

    entities.push({
      id: entityId,
      category: "disaster",
      kind: "earthquake",
      label: record.place,
      location,
      locationObservationId: observationId,
      // firstSeenAt/lastSeenAt left empty: the event time is Observation.observedAt,
      // and there is no tracking over time yet.
    });

    observations.push({
      id: observationId,
      entityId,
      sourceId: USGS_EARTHQUAKES_SOURCE.id,
      // AURELIS did not observe the event; it consumed the USGS report.
      nature: "reported",
      confidence: "unknown",
      observedAt,
      // Latest update of this USGS record, not its first publication.
      reportedAt: new Date(record.updated).toISOString(),
      ingestedAt,
      location,
      data: {
        magnitude: record.mag,
        magnitudeType: record.magType,
        place: record.place,
        depthKm: record.depthKm,
        status: record.status,
        significance: record.sig,
        tsunamiFlag: record.tsunami,
        alert: record.alert,
        preferredNetwork: record.net,
      },
      sourceRecordId: record.id,
      sourceUrl: record.url,
    });
  }

  const metadata = isRecord(payload.metadata) ? payload.metadata : {};

  return {
    source: USGS_EARTHQUAKES_SOURCE,
    entities,
    observations,
    metadata: {
      ingestedAt,
      feedGeneratedAt: isFiniteNumber(metadata.generated)
        ? new Date(metadata.generated).toISOString()
        : undefined,
      receivedRecords: payload.features.length,
      count: entities.length,
      skippedRecords,
      excludedRecords,
    },
  };
}

interface UsgsRecord {
  id: string;
  longitude: number;
  latitude: number;
  depthKm: number;
  time: number;
  updated: number;
  mag: number | null;
  magType?: string;
  place?: string;
  status?: string;
  sig?: number;
  tsunami?: boolean;
  alert: string | null;
  net?: string;
  url?: string;
}

/** Minimal runtime validation of one feature. Never throws. */
function parseFeature(feature: unknown): UsgsRecord | "skip" | "exclude" {
  if (!isRecord(feature) || typeof feature.id !== "string" || !feature.id) {
    return "skip";
  }
  const { geometry, properties: p } = feature;
  if (!isRecord(geometry) || geometry.type !== "Point" || !isRecord(p)) {
    return "skip";
  }
  const coords = geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 3) return "skip";
  const [longitude, latitude, depthKm] = coords;
  if (
    !isFiniteNumber(longitude) || longitude < -180 || longitude > 180 ||
    !isFiniteNumber(latitude) || latitude < -90 || latitude > 90 ||
    !isFiniteNumber(depthKm) ||
    !isFiniteNumber(p.time) ||
    !isFiniteNumber(p.updated) ||
    (p.mag !== null && !isFiniteNumber(p.mag))
  ) {
    return "skip";
  }
  // Only seismic events typed "earthquake" (USGS also lists e.g. "quarry"); never deleted ones.
  if (p.type !== "earthquake" || p.status === "deleted") return "exclude";

  return {
    id: feature.id,
    longitude,
    latitude,
    depthKm,
    time: p.time,
    updated: p.updated,
    mag: p.mag,
    magType: optionalString(p.magType),
    place: optionalString(p.place),
    status: optionalString(p.status),
    sig: isFiniteNumber(p.sig) ? p.sig : undefined,
    tsunami: p.tsunami === 1 ? true : p.tsunami === 0 ? false : undefined,
    alert: optionalString(p.alert) ?? null,
    net: optionalString(p.net),
    url:
      typeof p.url === "string" && p.url.startsWith("https://") ? p.url : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
