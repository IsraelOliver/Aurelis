import type { IsoDateTime } from "./common";
import type { AurelisEntity } from "./entity";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * Earthquake-specific payload of an Observation (Observation.data).
 * Field meanings follow the USGS ComCat event terms; see AURELIS_CONTEXT.md.
 */
export interface EarthquakeObservationData {
  /** Preferred magnitude reported by the source; null when not reported. */
  magnitude: number | null;
  /** Method used for the preferred magnitude, e.g. "mb", "ml", "mww". */
  magnitudeType?: string;
  /** Textual description of a named region near the event. */
  place?: string;
  /** Depth of the hypocenter in km. NOT an altitude. */
  depthKm: number;
  /** Review status at the source, e.g. "automatic", "reviewed". */
  status?: string;
  /** Source's significance score (USGS "sig", larger = more significant). */
  significance?: number;
  /**
   * USGS "tsunami" flag: set for large events in oceanic regions.
   * It does NOT indicate that a tsunami exists or will exist.
   */
  tsunamiFlag?: boolean;
  /** PAGER alert level ("green" | "yellow" | "orange" | "red"), null when absent. */
  alert: string | null;
  /** Network the source considers the preferred contributor (USGS "net"). */
  preferredNetwork?: string;
}

export type EarthquakeObservation = Observation<EarthquakeObservationData>;

/** Normalized state of an earthquake feed, as served by /api/earthquakes. */
export interface EarthquakeFeed {
  source: IntelligenceSource;
  entities: AurelisEntity[];
  observations: EarthquakeObservation[];
  metadata: {
    /** When the AURELIS server received the feed. */
    ingestedAt: IsoDateTime;
    /** When the source generated the feed, if stated. */
    feedGeneratedAt?: IsoDateTime;
    /** Records present in the source payload. */
    receivedRecords: number;
    /** Records normalized into entities/observations. */
    count: number;
    /** Malformed or duplicate records that were dropped. */
    skippedRecords: number;
    /** Well-formed records intentionally left out (non-earthquake or deleted). */
    excludedRecords: number;
  };
}
