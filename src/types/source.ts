/**
 * General assessment of a source as a whole.
 * It does NOT make every record from that source true; per-claim trust
 * lives in Observation.confidence / EntityRelationship.confidence.
 */
export type SourceReliability = "unknown" | "low" | "medium" | "high";

export type SourceCategory =
  | "government"
  | "research"
  | "community"
  | "commercial"
  | "open-data"
  | "other";

/** A provider of information (a feed, an API, a dataset, a publication). */
export interface IntelligenceSource {
  /** AURELIS-internal id. */
  id: string;
  name: string;
  /** Organization behind the source, when different from `name`. */
  provider?: string;
  category: SourceCategory;
  /** Homepage or documentation of the source (not a specific record). */
  url?: string;
  reliability: SourceReliability;
  description?: string;
}
