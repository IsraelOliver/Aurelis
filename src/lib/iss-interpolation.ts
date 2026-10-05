import { TRAIL_MAX_GAP_MS, type TrailPoint } from "./iss-trail";

/**
 * Visual-only smoothing of the ISS marker (position and altitude). The marker is drawn about this
 * far behind the latest received observation, moving between two received
 * positions. No prediction or extrapolation, and nothing here creates
 * observations or trail points.
 */
export const VISUAL_DELAY_MS = 5_000;

/**
 * Display position and altitude at `displayTime` (epoch ms, source timeline):
 * - no positions → null;
 * - before the first / after the last position → that position (no
 *   extrapolation: with a stale source the marker stops at the last one);
 * - between two positions further apart than TRAIL_MAX_GAP_MS → stays at the
 *   earlier one (an untracked gap is not animated);
 * - otherwise linear interpolation by time, longitude along the shortest
 *   path across ±180°; altitude interpolated for the same instant.
 */
export function interpolatePosition(
  points: TrailPoint[],
  displayTime: number,
): DisplayPosition | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (displayTime <= first.t) return at(first);
  if (displayTime >= last.t) return at(last);

  let i = points.length - 2;
  while (i > 0 && points[i].t > displayTime) i--;
  const a = points[i];
  const b = points[i + 1];
  if (b.t - a.t > TRAIL_MAX_GAP_MS) return at(a);

  const f = Math.min(1, Math.max(0, (displayTime - a.t) / (b.t - a.t)));
  return {
    lon: interpolateLongitude(a.lon, b.lon, f),
    lat: a.lat + f * (b.lat - a.lat),
    altitudeKm: a.altitudeKm + f * (b.altitudeKm - a.altitudeKm),
  };
}

export type DisplayPosition = { lon: number; lat: number; altitudeKm: number };

const at = (p: TrailPoint): DisplayPosition => ({ lon: p.lon, lat: p.lat, altitudeKm: p.altitudeKm });

/** Longitude between a and b along the shortest path, wrapped to [-180, 180]. */
export function interpolateLongitude(a: number, b: number, f: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  const lon = a + f * delta;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
