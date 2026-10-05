import type { IsoDateTime } from "./common";
import type { GeoLocation } from "./location";

/**
 * Domain of an entity. Independent from the sidebar categories
 * (src/lib/categories.ts), which are UI groupings.
 */
export type EntityCategory =
  | "cyber"
  | "aviation"
  | "maritime"
  | "space"
  | "weather"
  | "disaster"
  | "infrastructure"
  | "other";

/**
 * Something that exists or is tracked over time (a server, an aircraft,
 * a volcano...). Only the common core: domain-specific identifiers and
 * attributes belong in specialized structures, added when needed.
 *
 * An entity holds no claims by itself; what is known about it comes from
 * Observations.
 */
export interface AurelisEntity {
  /** AURELIS-internal id (not a source record id, not an IP/ICAO24/MMSI). */
  id: string;
  category: EntityCategory;
  /** Free-form subtype within the category, e.g. "server", "aircraft". */
  kind: string;
  label?: string;
  /** Current/representative location, if any. */
  location?: GeoLocation;
  /** Observation that supports `location`, for provenance. */
  locationObservationId?: string;
  /**
   * First / last time AURELIS saw the entity while tracking it over time.
   * Not the time of a one-off event (that is Observation.observedAt).
   * Left empty until persistence and real tracking exist.
   */
  firstSeenAt?: IsoDateTime;
  lastSeenAt?: IsoDateTime;
}
