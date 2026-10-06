import type { GlobalHealth, SourceHealth } from "@/types";

export interface SyncConfig {
  /** Client polling interval for the source's internal API route. */
  pollIntervalMs: number;
  /**
   * A snapshot is fresh while its ingestedAt is at most this old:
   * max age the server may serve + one poll interval (+ margin), so a
   * healthy integration never flips to "stale" between polls.
   */
  freshnessWindowMs: number;
}

/**
 * USGS: feed updates every minute. The route may serve a snapshot up to
 * 120 s old (MAX_AGE_MS in app/api/earthquakes/route.ts) + 60 s poll = 180 s.
 */
export const USGS_SYNC: SyncConfig = { pollIntervalMs: 60_000, freshnessWindowMs: 180_000 };

/**
 * ISS: position changes continuously. The route serves a position at most
 * ~4 s old (MIN_FETCH_INTERVAL_MS in app/api/space/iss/route.ts) + 5 s poll
 * + latency ≈ 10 s; 15 s leaves margin without calling an old position current.
 */
export const ISS_SYNC: SyncConfig = { pollIntervalMs: 5_000, freshnessWindowMs: 15_000 };

/**
 * NOAA SWPC planetary Kp: product updates every minute. The route serves a
 * snapshot at most ~45 s old (MIN_FETCH_INTERVAL_MS in
 * app/api/space/weather/kp/route.ts) + 60 s poll ≈ 105 s; 180 s leaves margin
 * for one slow/failed attempt, as for USGS.
 */
export const NOAA_KP_SYNC: SyncConfig = { pollIntervalMs: 60_000, freshnessWindowMs: 180_000 };

export function deriveHealth(input: {
  hasSnapshot: boolean;
  attempted: boolean;
  lastAttemptFailed: boolean;
  snapshotAgeMs: number | null;
  freshnessWindowMs: number;
}): SourceHealth {
  if (!input.hasSnapshot) {
    return input.attempted && input.lastAttemptFailed ? "unavailable" : "syncing";
  }
  if (input.lastAttemptFailed) return "stale";
  return input.snapshotAgeMs !== null && input.snapshotAgeMs <= input.freshnessWindowMs
    ? "fresh"
    : "stale";
}

/**
 * Global state from the per-source states (checked in this order):
 * - all fresh                                   → "live"
 * - all syncing                                 → "syncing"
 * - nothing stale/unavailable (some still syncing) → "syncing"
 * - at least one fresh and one stale/unavailable → "partial"
 * - none fresh, at least one stale              → "stale"
 * - otherwise (only syncing/unavailable)         → "unavailable"
 */
export function aggregateHealth(healths: SourceHealth[]): GlobalHealth {
  if (healths.every((h) => h === "fresh")) return "live";
  if (healths.every((h) => h === "syncing")) return "syncing";
  if (!healths.some((h) => h === "stale" || h === "unavailable")) return "syncing";
  if (healths.some((h) => h === "fresh")) return "partial";
  if (healths.some((h) => h === "stale")) return "stale";
  return "unavailable";
}
