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

/**
 * NOAA SWPC OVATION aurora: the file changes on a scale of minutes (observed,
 * not an NOAA SLA). The route serves a snapshot at most ~4 min old
 * (MIN_FETCH_INTERVAL_MS in app/api/space/weather/aurora/route.ts) + 5 min
 * poll ≈ 9 min; 20 min tolerates transient delays. AURELIS operational policy.
 */
export const NOAA_OVATION_SYNC: SyncConfig = {
  pollIntervalMs: 5 * 60_000,
  freshnessWindowMs: 20 * 60_000,
};

/**
 * NOAA SWPC RTSW plasma and magnetic field (one config, two independent
 * feeds): 1-minute samples, published with a few minutes of delay. The routes
 * serve a snapshot at most ~45 s old (MIN_FETCH_INTERVAL_MS in
 * app/api/space/weather/solar-wind/*) + 60 s poll ≈ 105 s; 5 min tolerates
 * transient delays. AURELIS operational policy, not an NOAA SLA.
 */
export const NOAA_RTSW_SYNC: SyncConfig = { pollIntervalMs: 60_000, freshnessWindowMs: 5 * 60_000 };

/**
 * NOAA SWPC GOES X-ray: 1-minute samples. The route serves a snapshot at most
 * ~45 s old (app/api/space/weather/xray/route.ts) + 60 s poll ≈ 105 s; 5 min
 * tolerates transient delays. AURELIS operational policy, not an NOAA SLA.
 */
export const NOAA_XRAY_SYNC: SyncConfig = { pollIntervalMs: 60_000, freshnessWindowMs: 5 * 60_000 };

/**
 * NASA EONET: near real time, with very different cadences per category.
 * The route serves a snapshot at most ~4 min old (app/api/disasters/eonet)
 * + 5 min poll ≈ 9 min; 20 min tolerates the slow (~10 s, ~5 MB) upstream
 * call and transient delays. Measures the age of AURELIS's last successful
 * snapshot, NOT how recently each event was updated. AURELIS operational
 * policy, not a NASA SLA.
 */
export const NASA_EONET_SYNC: SyncConfig = { pollIntervalMs: 5 * 60_000, freshnessWindowMs: 20 * 60_000 };

/**
 * Open-Meteo point weather (query-scoped, on demand): only exists while a
 * weather point is selected. Poll 10 min; freshness 30 min = age of the last
 * successful AURELIS snapshot FOR THAT POINT, not the age of the model run.
 * AURELIS operational policy, not an Open-Meteo SLA.
 */
export const OPEN_METEO_SYNC: SyncConfig = { pollIntervalMs: 10 * 60_000, freshnessWindowMs: 30 * 60_000 };

/**
 * NOAA GFS cloud cover (on demand, only while the layer is shown): runs every
 * 6 h, published ~3.5 h later; the selected hourly step changes every hour.
 * Client poll 30 min (+ server check at most every 10 min) keeps the shown
 * field within ~1 h of now. Freshness here is NOT the age of ingestedAt: it is
 * |now − validAt| of the field on the map, fresh while ≤ 90 min. AURELIS
 * operational policy, not an NOAA SLA.
 */
export const NOAA_GFS_CLOUDS_SYNC: SyncConfig = { pollIntervalMs: 30 * 60_000, freshnessWindowMs: 90 * 60_000 };

/**
 * OpenSky aircraft (global, only while AIR is active): one /states/all request
 * every 30 s (4 credits) while AIR is open and aircraft shown; paused otherwise.
 * Fresh while the last snapshot is at most two refreshes + 30 s old. Paused
 * polling is not evaluated (not listed). AURELIS policy, not an OpenSky SLA.
 */
export const OPENSKY_SYNC: SyncConfig = { pollIntervalMs: 30_000, freshnessWindowMs: 90_000 };

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
