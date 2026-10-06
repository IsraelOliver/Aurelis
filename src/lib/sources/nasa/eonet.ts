import type { Position } from "geojson";
import type {
  AurelisEntity,
  EonetCategory,
  EonetEventObservation,
  EonetFeed,
  EonetGeometry,
  EonetUpstreamSource,
} from "@/types";
import { NASA_EONET_EVENTS_URL, NASA_EONET_SOURCE, eonetEntityId } from "./eonet-source";

/**
 * NASA EONET v3 adapter: the only place that knows its JSON format.
 * Docs: https://eonet.gsfc.nasa.gov/docs/v3 (no key). Query: status=open
 * only (explicit, also the default); no `days` or `limit`, since an event can
 * legitimately stay open for weeks.
 *
 * - EONET curates/aggregates events from upstream sources: nature "reported",
 *   confidence unknown. Upstream sources are kept per event, not promoted to
 *   AURELIS sources.
 * - Disclaimer (EONET): "for visualization and general information purposes
 *   only … spatial and temporal extents … are approximations at best". Point
 *   locations are therefore "approximate"; polygons are kept as published and
 *   never reduced to an invented centroid.
 * - Geometry `date` is kept as is ("most likely 00:00Z unless the source
 *   provided a particular time"): never promoted to observedAt or reportedAt.
 * - The `earthquakes` category is not ingested: AURELIS uses the direct USGS
 *   feed for earthquakes (no coordinate/magnitude deduplication attempted).
 */

/** Official category id (verified on /api/v3/categories). */
export const EONET_EARTHQUAKES_CATEGORY = "earthquakes";

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const isString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function validPosition(p: unknown): p is Position {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    finite(p[0]) &&
    finite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

/** A linear ring: ≥ 4 valid positions, closed (first = last), per RFC 7946. */
function validRing(ring: unknown): ring is Position[] {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validPosition)) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

/** A valid geometry, or null (discarded). Magnitude fields only when actually present. */
export function normalizeGeometry(raw: unknown): EonetGeometry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.date !== "string" || !ISO_WITH_ZONE.test(g.date) || !Number.isFinite(Date.parse(g.date))) {
    return null;
  }
  let coordinates: Position | Position[][];
  if (g.type === "Point" && validPosition(g.coordinates)) {
    coordinates = [g.coordinates[0], g.coordinates[1]];
  } else if (
    g.type === "Polygon" &&
    Array.isArray(g.coordinates) &&
    g.coordinates.length > 0 &&
    g.coordinates.every(validRing)
  ) {
    coordinates = g.coordinates as Position[][];
  } else {
    return null;
  }
  return {
    date: new Date(g.date).toISOString(),
    type: g.type,
    coordinates,
    magnitudeValue: finite(g.magnitudeValue) ? g.magnitudeValue : undefined,
    magnitudeUnit: isString(g.magnitudeUnit) ? g.magnitudeUnit : undefined,
    magnitudeDescription: isString(g.magnitudeDescription) ? g.magnitudeDescription : undefined,
  };
}

function normalizeCategories(raw: unknown): EonetCategory[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((c) =>
    typeof c === "object" && c !== null && isString((c as EonetCategory).id) && isString((c as EonetCategory).title)
      ? [{ id: (c as EonetCategory).id, title: (c as EonetCategory).title }]
      : [],
  );
}

function normalizeUpstream(raw: unknown): EonetUpstreamSource[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((s) =>
    typeof s === "object" && s !== null && isString((s as EonetUpstreamSource).id) && isString((s as EonetUpstreamSource).url)
      ? [{ id: (s as EonetUpstreamSource).id, url: (s as EonetUpstreamSource).url }]
      : [],
  );
}

export function normalizeEonet(payload: unknown, ingestedAt: string): EonetFeed {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { events?: unknown }).events)) {
    throw new Error("EONET payload has no events array");
  }
  const events = (payload as { events: unknown[] }).events;
  const entities: AurelisEntity[] = [];
  const observations: EonetEventObservation[] = [];
  const meta = {
    excludedEarthquakes: 0,
    discardedNoValidGeometry: 0,
    discardedInvalidEvent: 0,
    geometriesDiscarded: 0,
    latestPoints: 0,
    latestPolygons: 0,
  };
  const seen = new Set<string>();

  for (const raw of events) {
    if (typeof raw !== "object" || raw === null) {
      meta.discardedInvalidEvent++;
      continue;
    }
    const e = raw as Record<string, unknown>;
    const categories = normalizeCategories(e.categories);
    const upstreamSources = normalizeUpstream(e.sources);
    if (
      !isString(e.id) ||
      !isString(e.title) ||
      e.closed !== null ||
      !categories ||
      !upstreamSources ||
      !Array.isArray(e.geometry) ||
      seen.has(e.id)
    ) {
      meta.discardedInvalidEvent++;
      continue;
    }
    if (categories.some((c) => c.id === EONET_EARTHQUAKES_CATEGORY)) {
      meta.excludedEarthquakes++;
      continue;
    }
    const valid = e.geometry.map(normalizeGeometry);
    const geometries = valid.filter((g): g is EonetGeometry => g !== null);
    meta.geometriesDiscarded += valid.length - geometries.length;
    if (geometries.length === 0) {
      meta.discardedNoValidGeometry++;
      continue;
    }
    // Latest by real date, never by array position.
    geometries.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const latestGeometryIndex = geometries.length - 1;
    const latest = geometries[latestGeometryIndex];
    seen.add(e.id);

    const entityId = eonetEntityId(e.id);
    const observationId = `${NASA_EONET_SOURCE.id}:${e.id}:${latest.date}`;
    const point = latest.type === "Point" ? (latest.coordinates as Position) : null;
    if (point) meta.latestPoints++;
    else meta.latestPolygons++;

    entities.push({
      id: entityId,
      category: "disaster",
      kind: "natural-event",
      label: e.title,
      // Point: approximate (EONET disclaimer). Polygon: no invented centroid.
      ...(point
        ? {
            location: { longitude: point[0], latitude: point[1], precision: "approximate" as const },
            locationObservationId: observationId,
          }
        : {}),
    });
    observations.push({
      id: observationId,
      entityId,
      sourceId: NASA_EONET_SOURCE.id,
      nature: "reported",
      confidence: "unknown",
      // No observedAt / reportedAt: geometry dates have no guaranteed observation or publication meaning.
      ingestedAt,
      data: {
        eonetId: e.id,
        title: e.title,
        description: isString(e.description) ? e.description : undefined,
        categories,
        upstreamSources,
        eonetStatus: "open",
        geometries,
        latestGeometryIndex,
      },
      sourceRecordId: e.id,
      sourceUrl: isString(e.link) ? e.link : `${NASA_EONET_EVENTS_URL}/${e.id}`,
    });
  }

  return {
    source: NASA_EONET_SOURCE,
    entities,
    observations,
    metadata: {
      ingestedAt,
      eventsReceived: events.length,
      eventsIngested: entities.length,
      ...meta,
    },
  };
}

export async function fetchEonetOpenEvents(): Promise<EonetFeed> {
  // ~5 MB and ~10 s upstream: never in Next's data cache, generous timeout.
  const response = await fetch(`${NASA_EONET_EVENTS_URL}?status=open`, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`NASA EONET responded ${response.status}`);
  return normalizeEonet(await response.json(), new Date().toISOString());
}
