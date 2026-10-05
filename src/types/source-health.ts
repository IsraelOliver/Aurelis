import type { IsoDateTime } from "./common";

/**
 * Technical state of a source integration in this session.
 * Unrelated to IntelligenceSource.reliability (a methodological assessment).
 * - "syncing": first snapshot not obtained yet, no attempt has failed.
 * - "fresh": last attempt succeeded and the snapshot is within the freshness window.
 * - "stale": a snapshot exists, but the last attempt failed or it is older than the window.
 * - "unavailable": no usable snapshot in this session, and an attempt has failed.
 */
export type SourceHealth = "syncing" | "fresh" | "stale" | "unavailable";

export interface SourceSyncState {
  sourceId: string;
  health: SourceHealth;
  /** Client clock: last time a request to the internal API was started. */
  lastAttemptAt?: IsoDateTime;
  /** Client clock: last time a request returned a valid snapshot. */
  lastSuccessAt?: IsoDateTime;
  /** Server clock: ingestedAt of the snapshot currently shown. */
  lastIngestedAt?: IsoDateTime;
}
