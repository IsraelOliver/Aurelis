import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * NOAA SWPC near-real-time planetary Kp payload (Observation.data).
 * A global geomagnetic index: no location and no Entity.
 */
export interface PlanetaryKpObservationData {
  /** `estimated_kp`: estimated planetary Kp, 0–9 (in thirds, e.g. 1.33, 1.67). */
  estimatedKp: number;
  /** Raw `kp_index` (integer). Kept as received; its derivation is not documented, not displayed. */
  kpIndex?: number;
  /** Raw `kp` code (e.g. "2M", "1P"). Kept as received; not documented, not displayed. */
  kpCode?: string;
}

export type PlanetaryKpObservation = Observation<PlanetaryKpObservationData>;

/** Normalized Kp snapshot, as served by /api/space/weather/kp. No entities. */
export interface PlanetaryKpFeed {
  source: IntelligenceSource;
  /** Valid samples in the recent window, oldest first (sorted by observedAt). */
  observations: PlanetaryKpObservation[];
  /** The valid sample with the greatest observedAt (not the last array item). */
  latestObservationId: string | null;
  metadata: {
    /** When the AURELIS server received the response. */
    ingestedAt: IsoDateTime;
    /** Window kept, relative to the latest sample. */
    windowHours: number;
    /** Records in the upstream payload / records rejected by validation. */
    recordsReceived: number;
    recordsRejected: number;
  };
}
