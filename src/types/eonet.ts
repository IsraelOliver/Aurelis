import type { Position } from "geojson";
import type { IsoDateTime } from "./common";
import type { AurelisEntity } from "./entity";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * NASA EONET (v3) natural events, as curated/aggregated by EONET from many
 * upstream sources. EONET states its metadata is for visualization and
 * general information only; spatial and temporal extents are often
 * approximations. Nothing here is more precise than that.
 */

/** One EONET geometry: a date paired with a Point or Polygon, as published. */
export interface EonetGeometry {
  /**
   * Source "date". EONET: "will most likely be 00:00Z unless the source
   * provided a particular time". Not an observation or publication time.
   */
  date: IsoDateTime;
  type: "Point" | "Polygon";
  /** GeoJSON coordinates as published: Position for Point, rings for Polygon. */
  coordinates: Position | Position[][];
  magnitudeValue?: number;
  magnitudeUnit?: string;
  magnitudeDescription?: string;
}

export interface EonetCategory {
  id: string;
  title: string;
}

/** An upstream source referenced by the event (not an AURELIS IntelligenceSource). */
export interface EonetUpstreamSource {
  id: string;
  url: string;
}

/** Observation.data of an EONET event snapshot. */
export interface EonetEventData {
  eonetId: string;
  title: string;
  description?: string;
  /** All categories, in source order; none is treated as primary. */
  categories: EonetCategory[];
  upstreamSources: EonetUpstreamSource[];
  /** `closed` is null: open in EONET (not a claim that the event is happening now). */
  eonetStatus: "open";
  /** Valid geometries, oldest first (sorted by date). */
  geometries: EonetGeometry[];
  /** Index in `geometries` of the latest one by date (the one drawn on the map). */
  latestGeometryIndex: number;
}

export type EonetEventObservation = Observation<EonetEventData>;

/** Normalized snapshot, as served by /api/disasters/eonet. */
export interface EonetFeed {
  source: IntelligenceSource;
  entities: AurelisEntity[];
  observations: EonetEventObservation[];
  metadata: {
    ingestedAt: IsoDateTime;
    eventsReceived: number;
    eventsIngested: number;
    /** Events in the `earthquakes` category: not ingested (AURELIS uses USGS directly). */
    excludedEarthquakes: number;
    /** Events without any valid geometry: not ingested (7A is a geographic integration). */
    discardedNoValidGeometry: number;
    /** Other structurally invalid events (missing id/title/arrays, not open). */
    discardedInvalidEvent: number;
    geometriesDiscarded: number;
    latestPoints: number;
    latestPolygons: number;
  };
}
