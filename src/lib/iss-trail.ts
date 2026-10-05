/**
 * Recent tracked path of the ISS, built only from positions AURELIS actually
 * received (no prediction, no orbit, no TLE). Kept in memory, bounded.
 */

export interface TrailPoint {
  lon: number;
  lat: number;
  /** observedAt of the position, epoch ms. */
  t: number;
  /** Altitude reported with the position (Observation data.altitudeKm); not part of the ground track. */
  altitudeKm: number;
}

/** Keep positions observed within this window before the newest one… */
export const TRAIL_WINDOW_MS = 10 * 60_000;
/** …and never more than this many (10 min at one position every 5 s). */
export const TRAIL_MAX_POINTS = 120;
/**
 * Consecutive positions further apart than this are not joined: the path
 * between them was not tracked (stale source, throttled tab, recovery).
 */
export const TRAIL_MAX_GAP_MS = 30_000;

/**
 * Appends a new position. Ignores repeats/out-of-order positions. The window
 * is relative to the newest position, so nothing expires while the source is
 * stale (the last valid path is kept, no points are invented).
 */
export function appendTrailPoint(trail: TrailPoint[], point: TrailPoint): TrailPoint[] {
  const last = trail[trail.length - 1];
  if (last && point.t <= last.t) return trail;
  const next = [...trail, point].filter((p) => p.t >= point.t - TRAIL_WINDOW_MS);
  return next.length > TRAIL_MAX_POINTS ? next.slice(-TRAIL_MAX_POINTS) : next;
}

/**
 * Splits the path into line segments ([lon, lat][]) for a MultiLineString:
 * - at time gaps larger than TRAIL_MAX_GAP_MS;
 * - at the antimeridian: when consecutive longitudes differ by more than 180°,
 *   the crossing latitude is interpolated and the segment ends at ±180° and
 *   the next one starts at ∓180°, so no line spans the whole map.
 */
export function trailToSegments(trail: TrailPoint[]): [number, number][][] {
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];

  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };

  trail.forEach((p, i) => {
    const prev = trail[i - 1];
    if (prev && p.t - prev.t > TRAIL_MAX_GAP_MS) {
      flush();
    } else if (prev && Math.abs(p.lon - prev.lon) > 180) {
      // Crossing eastward (+180 → -180) when prev is in the east, westward otherwise.
      const edge = prev.lon > 0 ? 180 : -180;
      const unwrappedLon = p.lon + 2 * edge;
      const f = (edge - prev.lon) / (unwrappedLon - prev.lon);
      const crossingLat = prev.lat + f * (p.lat - prev.lat);
      current.push([edge, crossingLat]);
      flush();
      current.push([-edge, crossingLat]);
    }
    current.push([p.lon, p.lat]);
  });
  flush();
  return segments;
}

/** A vertex of the orbital (3D) trail: position and the altitude reported with it. */
export type OrbitVertex = { lon: number; lat: number; altitudeKm: number };

/**
 * Line strips for the orbital trail on the globe, ending exactly at the
 * displayed ISS marker:
 * - only received positions observed up to `displayTime` (the marker is drawn
 *   ~5 s behind; positions it has not reached yet are left out);
 * - split at time gaps larger than TRAIL_MAX_GAP_MS (untracked stretches);
 * - not split at the antimeridian: on the sphere consecutive positions are
 *   close, so the line crosses ±180° naturally;
 * - `display` (the marker's interpolated position/altitude) is appended as a
 *   visual-only endpoint; it is never stored in the trail.
 */
export function orbitTrailStrips(
  trail: TrailPoint[],
  displayTime: number,
  display: OrbitVertex | null,
): OrbitVertex[][] {
  const strips: OrbitVertex[][] = [];
  let current: OrbitVertex[] = [];
  let lastT: number | null = null;
  for (const p of trail) {
    if (p.t > displayTime) break;
    if (lastT !== null && p.t - lastT > TRAIL_MAX_GAP_MS) {
      if (current.length > 1) strips.push(current);
      current = [];
    }
    current.push({ lon: p.lon, lat: p.lat, altitudeKm: p.altitudeKm });
    lastT = p.t;
  }
  if (display && current.length > 0) current.push(display);
  if (current.length > 1) strips.push(current);
  return strips;
}
