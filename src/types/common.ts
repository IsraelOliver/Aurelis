/**
 * ISO 8601 date-time string in UTC, e.g. "2026-10-05T13:45:12Z".
 * Alias for documentation only; values are not validated at this stage.
 */
export type IsoDateTime = string;

/**
 * How much AURELIS trusts a specific claim (an observation or a relationship).
 * "unknown" is the honest default when no basis for an assessment exists.
 */
export type ConfidenceLevel = "unknown" | "low" | "medium" | "high";
