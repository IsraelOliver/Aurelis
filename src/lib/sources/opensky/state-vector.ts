import type { AircraftRow, AircraftStateData } from "@/types";
import { AIR_MAX_POSITION_AGE_S, POSITION_SOURCES } from "./source";

/**
 * The ONLY place that knows the positional layout of an OpenSky state vector
 * (REST docs, /states/all, "State Vectors" table). Everything else uses the
 * named fields below.
 */
const IDX = {
  icao24: 0,
  callsign: 1,
  originCountry: 2,
  timePosition: 3,
  lastContact: 4,
  longitude: 5,
  latitude: 6,
  baroAltitude: 7,
  onGround: 8,
  velocity: 9,
  trueTrack: 10,
  verticalRate: 11,
  // 12: sensors (receiver ids; not used)
  geoAltitude: 13,
  squawk: 14,
  spi: 15,
  positionSource: 16,
} as const;
const MIN_LENGTH = 17;

export type ParsedStateVector = {
  icao24: string;
  callsign?: string;
  originCountry?: string;
  timePositionS?: number;
  lastContactS?: number;
  longitude?: number;
  latitude?: number;
  baroAltitudeM?: number;
  onGround?: boolean;
  velocityMps?: number;
  trueTrackDeg?: number;
  verticalRateMps?: number;
  geoAltitudeM?: number;
  squawk?: string;
  spi?: boolean;
  positionSource?: AircraftStateData["positionSource"];
  positionSourceCode?: number;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/** Named, typed fields of one raw vector; null for a malformed one (no valid ICAO24). */
export function parseOpenSkyStateVector(raw: unknown): ParsedStateVector | null {
  if (!Array.isArray(raw) || raw.length < MIN_LENGTH) return null;
  const icao = raw[IDX.icao24];
  if (typeof icao !== "string" || !/^[0-9a-f]{6}$/i.test(icao.trim())) return null;
  const lat = num(raw[IDX.latitude]);
  const lon = num(raw[IDX.longitude]);
  const validPosition = lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const track = num(raw[IDX.trueTrack]);
  const source = num(raw[IDX.positionSource]);
  return {
    icao24: icao.trim().toLowerCase(),
    callsign: text(raw[IDX.callsign]),
    originCountry: text(raw[IDX.originCountry]),
    timePositionS: num(raw[IDX.timePosition]),
    lastContactS: num(raw[IDX.lastContact]),
    latitude: validPosition ? lat : undefined,
    longitude: validPosition ? lon : undefined,
    baroAltitudeM: num(raw[IDX.baroAltitude]),
    onGround: bool(raw[IDX.onGround]),
    velocityMps: num(raw[IDX.velocity]),
    trueTrackDeg: track !== undefined && track >= 0 && track <= 360 ? track : undefined,
    verticalRateMps: num(raw[IDX.verticalRate]),
    geoAltitudeM: num(raw[IDX.geoAltitude]),
    squawk: text(raw[IDX.squawk]),
    spi: bool(raw[IDX.spi]),
    positionSource: source !== undefined && Number.isInteger(source) ? POSITION_SOURCES[source] : undefined,
    positionSourceCode: source !== undefined && Number.isInteger(source) && POSITION_SOURCES[source] ? source : undefined,
  };
}

/** Keeps, per ICAO24, the vector with the latest last contact (a response should not repeat one; guarded anyway). */
export function dedupeByIcao24(vectors: ParsedStateVector[]): ParsedStateVector[] {
  const byId = new Map<string, ParsedStateVector>();
  for (const v of vectors) {
    const prev = byId.get(v.icao24);
    if (!prev || (v.lastContactS ?? -Infinity) > (prev.lastContactS ?? -Infinity)) byId.set(v.icao24, v);
  }
  return [...byId.values()];
}

const nul = <T,>(v: T | undefined): T | null => (v === undefined ? null : v);

/**
 * Compact row of an aircraft with a valid position whose time_position is at
 * most AIR_MAX_POSITION_AGE_S older than the response time; otherwise why it
 * is not drawn. Values are copied untouched (SI); nothing is rounded.
 */
export function toAircraftRow(v: ParsedStateVector, responseTimeS: number): AircraftRow | "noPosition" | "stalePosition" {
  if (v.latitude === undefined || v.longitude === undefined) return "noPosition";
  if (v.timePositionS === undefined || responseTimeS - v.timePositionS > AIR_MAX_POSITION_AGE_S) return "stalePosition";
  return [
    v.icao24,
    nul(v.callsign),
    nul(v.originCountry),
    v.timePositionS,
    nul(v.lastContactS),
    v.longitude,
    v.latitude,
    nul(v.baroAltitudeM),
    nul(v.onGround),
    nul(v.velocityMps),
    nul(v.trueTrackDeg),
    nul(v.verticalRateMps),
    nul(v.geoAltitudeM),
    nul(v.squawk),
    nul(v.spi),
    nul(v.positionSourceCode),
  ];
}
