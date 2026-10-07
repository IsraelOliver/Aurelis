import type { AircraftRow } from "@/types";
import { ROW } from "./sources/opensky/rows";

/**
 * Visual-only aircraft motion (same philosophy as the ISS): REAL OBSERVATIONS
 * ≠ DISPLAY POSITION. The map draws each aircraft at a display time behind the
 * source timeline and interpolates between TWO real received positions (their
 * own time_position). Never extrapolates: before the first or after the last
 * real position it holds that position. Observations are never modified.
 */

/** How the visual altitude was chosen (never presented as data). */
export type DisplayAltitudeSource = "geometric" | "barometric" | "ground" | "none";

export type MotionSample = {
  /** time_position, ms. */
  t: number;
  lon: number;
  lat: number;
  /** Visual altitude above the surface, m (0 for ground/none). */
  altM: number;
  altSource: DisplayAltitudeSource;
  /** Degrees clockwise from north, or null without a valid track. */
  trackDeg: number | null;
};

/** At most this many real positions are kept per aircraft (only the bracketing pair is used). */
export const MAX_SAMPLES = 4;
/** Positions further apart than this are not interpolated (the aircraft holds, then steps). AURELIS policy. */
export const MAX_INTERPOLATION_GAP_MS = 120_000;

/**
 * Visual altitude: geometric altitude first (closest to a 3D position), then
 * barometric as a labelled fallback, never one presented as the other. On the
 * ground → surface. Airborne without any altitude → surface (no invented
 * height), source "none". Negative values (below the ellipsoid/datum) are drawn
 * at the surface. Real scale: 10 000 m is drawn 10 km up, no exaggeration.
 */
export function displayAltitude(geoM: number | null, baroM: number | null, onGround: boolean | null): {
  altM: number;
  source: DisplayAltitudeSource;
} {
  if (onGround === true) return { altM: 0, source: "ground" };
  if (geoM !== null) return { altM: Math.max(0, geoM), source: "geometric" };
  if (baroM !== null) return { altM: Math.max(0, baroM), source: "barometric" };
  return { altM: 0, source: "none" };
}

export function sampleFromRow(row: AircraftRow): MotionSample {
  const alt = displayAltitude(row[ROW.geoAltitudeM], row[ROW.baroAltitudeM], row[ROW.onGround]);
  return {
    t: row[ROW.timePositionS] * 1000,
    lon: row[ROW.longitude],
    lat: row[ROW.latitude],
    altM: alt.altM,
    altSource: alt.source,
    trackDeg: row[ROW.trueTrackDeg],
  };
}

/**
 * Next per-aircraft real positions after a snapshot: the collection is exactly
 * the snapshot's aircraft (absent ones are dropped, nothing accumulates); a
 * newer time_position is appended; the same or an older one adds nothing.
 */
export function updateTracks(
  tracks: ReadonlyMap<string, MotionSample[]>,
  rows: AircraftRow[],
): Map<string, MotionSample[]> {
  const next = new Map<string, MotionSample[]>();
  for (const row of rows) {
    const id = row[ROW.icao24];
    const sample = sampleFromRow(row);
    const prev = tracks.get(id);
    const last = prev?.[prev.length - 1];
    if (!prev || !last) next.set(id, [sample]);
    else if (sample.t > last.t) next.set(id, [...prev, sample].slice(-MAX_SAMPLES));
    else next.set(id, prev);
  }
  return next;
}

/** Signed shortest angular difference b − a, in (−180, 180]. */
export function shortestDelta(a: number, b: number): number {
  const d = (((b - a) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
const wrapDeg = (deg: number) => ((deg % 360) + 360) % 360;

export type DisplayState = { lon: number; lat: number; altM: number; trackDeg: number | null };

/** Display state at source time `t` from the real positions (ascending). */
export function displayState(samples: MotionSample[], t: number): DisplayState {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const hold = (s: MotionSample): DisplayState => ({ lon: s.lon, lat: s.lat, altM: s.altM, trackDeg: s.trackDeg });
  if (t <= first.t) return hold(first);
  if (t >= last.t) return hold(last); // never beyond the latest real position
  let i = 0;
  while (samples[i + 1].t < t) i++;
  const a = samples[i];
  const b = samples[i + 1];
  if (b.t - a.t > MAX_INTERPOLATION_GAP_MS) return hold(a);
  const f = (t - a.t) / (b.t - a.t);
  // Vertical interpolation only between comparable altitude semantics; otherwise hold, then step at b.
  const altM = a.altSource === b.altSource ? a.altM + (b.altM - a.altM) * f : a.altM;
  const trackDeg =
    a.trackDeg !== null && b.trackDeg !== null
      ? wrapDeg(a.trackDeg + shortestDelta(a.trackDeg, b.trackDeg) * f)
      : (a.trackDeg ?? b.trackDeg);
  return {
    lon: wrapLon(a.lon + shortestDelta(a.lon, b.lon) * f),
    lat: a.lat + (b.lat - a.lat) * f,
    altM,
    trackDeg,
  };
}
