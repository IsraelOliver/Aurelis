import type { ConfidenceLevel, IsoDateTime } from "./common";
import type { GeoLocation } from "./location";

/**
 * How the claim came to exist.
 * - "observed": directly measured/sensed by the source (sensor, transponder, scan).
 * - "reported": stated by the source without its own measurement (advisory, report, feed entry).
 * - "estimated": computed by a model or method from measurements (e.g. magnitude, interpolated position).
 * - "inferred": a conclusion drawn from other data, by the source or by AURELIS.
 * - "forecast": model output about a future (or not yet observed) state, valid
 *   at `validAt` (e.g. an aurora forecast). Not an estimate of the present.
 */
export type EvidenceNature = "observed" | "reported" | "estimated" | "inferred" | "forecast";

/**
 * Something a specific source observed, reported or provided at a given moment.
 * `T` carries the source/domain-specific payload.
 */
export interface Observation<T = unknown> {
  /** AURELIS-internal id. */
  id: string;
  /** Entity this observation is about, when it is about one. */
  entityId?: string;

  /** Source AURELIS received this from. */
  sourceId: string;
  /** Original source, when `sourceId` only relays/aggregates someone else's data. */
  originSourceId?: string;

  nature: EvidenceNature;
  confidence: ConfidenceLevel;

  /** When the event happened or was observed in the world. */
  observedAt?: IsoDateTime;
  /** When the source published/reported it. */
  reportedAt?: IsoDateTime;
  /**
   * When a forecast/model output applies (the time it is valid for). Distinct
   * from observedAt, reportedAt and ingestedAt; set only when the source gives it.
   */
  validAt?: IsoDateTime;
  /** When AURELIS received it. Always known, set by AURELIS. */
  ingestedAt: IsoDateTime;

  location?: GeoLocation;
  data: T;

  /** Id of the record in the source's own system. */
  sourceRecordId?: string;
  /** Link to the specific record at the source. */
  sourceUrl?: string;
}
