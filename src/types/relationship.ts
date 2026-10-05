import type { ConfidenceLevel, IsoDateTime } from "./common";

/**
 * How the relationship is known. A relationship is never "estimated":
 * it either was observed, was stated by a source, or was inferred.
 */
export type RelationshipNature = "observed" | "reported" | "inferred";

/**
 * An explicit, evidence-backed link between two entities.
 *
 * The only thing allowed to produce a connection on the map.
 * Never create one from geographic proximity, array order, shared category,
 * shared source or temporal coincidence alone.
 */
export interface EntityRelationship {
  /** AURELIS-internal id. */
  id: string;
  /** Directional: read as "from <type> to", e.g. "controls", "communicates-with". */
  fromEntityId: string;
  toEntityId: string;
  type: string;

  nature: RelationshipNature;
  confidence: ConfidenceLevel;

  /** Source that asserted it. Absent when AURELIS itself inferred it. */
  sourceId?: string;
  /** Observations that support this relationship. */
  evidenceObservationIds?: string[];

  /** When the relationship was observed in the world. */
  observedAt?: IsoDateTime;
  /** When AURELIS recorded it. */
  createdAt: IsoDateTime;
  description?: string;
}
