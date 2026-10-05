import type { SourceHealth } from "@/types";

/** Client polling interval for /api/earthquakes (the USGS feed updates every minute). */
export const POLL_INTERVAL_MS = 60_000;

/**
 * A snapshot is fresh while its ingestedAt is at most this old.
 * The server may legitimately serve a snapshot up to 120 s old
 * (MAX_AGE_MS in app/api/earthquakes/route.ts), and the next poll comes
 * 60 s later: 120 + 60. A smaller window would flip a healthy integration
 * to "stale" between polls.
 */
export const FRESHNESS_WINDOW_MS = 180_000;

export function deriveHealth(input: {
  hasSnapshot: boolean;
  attempted: boolean;
  lastAttemptFailed: boolean;
  snapshotAgeMs: number | null;
}): SourceHealth {
  if (!input.hasSnapshot) {
    return input.attempted && input.lastAttemptFailed ? "unavailable" : "syncing";
  }
  if (input.lastAttemptFailed) return "stale";
  return input.snapshotAgeMs !== null && input.snapshotAgeMs <= FRESHNESS_WINDOW_MS
    ? "fresh"
    : "stale";
}
