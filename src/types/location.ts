/**
 * What the coordinates actually mean.
 * - "exact": the position itself was measured/reported (e.g. GPS, transponder).
 * - "approximate": near the point, with unspecified or `uncertaintyRadiusMeters` error.
 * - "city" | "region" | "country": only that area is known; the coordinates
 *   are a representative point of the area (e.g. a centroid), not a position.
 * - "unknown": precision was not stated by the source.
 */
export type LocationPrecision =
  | "exact"
  | "approximate"
  | "city"
  | "region"
  | "country"
  | "unknown";

/** A point in WGS84, decimal degrees, always paired with its precision. */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  precision: LocationPrecision;
  /** Error radius in meters, when the source provides one. */
  uncertaintyRadiusMeters?: number;
  altitudeMeters?: number;
  /** Human-readable place, e.g. "Brasília, DF". */
  label?: string;
  /** ISO 3166-1 alpha-2, e.g. "BR". */
  countryCode?: string;
}
