import type { IsoDateTime } from "./common";
import type { AurelisEntity } from "./entity";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * ISS-specific payload of an Observation (Observation.data), from
 * Where The ISS At? (units=kilometers).
 */
export interface IssObservationData {
  /** NORAD catalog id (25544 for the ISS). */
  noradId: number;
  /**
   * Altitude above the Earth, in km, as computed by the source. Documented:
   * `units` selects "miles or kilometers" and the response states "kilometers".
   */
  altitudeKm: number;
  /** Raw `velocity` value exactly as returned by the source. */
  velocity: number;
  /**
   * The documentation does not state the velocity unit: `units` only selects
   * the distance unit (miles/kilometers) and no time base is given. Not
   * inferred or converted.
   */
  velocityUnit: "unknown";
  /** Source value, e.g. "daylight" or "eclipsed". */
  visibility?: string;
}

export type IssObservation = Observation<IssObservationData>;

/** Normalized ISS state, as served by /api/space/iss. Latest position only. */
export interface IssFeed {
  source: IntelligenceSource;
  entities: AurelisEntity[];
  observations: IssObservation[];
  metadata: {
    /** When the AURELIS server received the position. */
    ingestedAt: IsoDateTime;
  };
}
