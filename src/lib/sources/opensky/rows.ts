import type { AircraftObservation, AircraftRow, AircraftStateData, AurelisEntity } from "@/types";
import { OPENSKY_AIRCRAFT_SOURCE, POSITION_SOURCES, aircraftEntityId } from "./source";

/**
 * Field positions of an AircraftRow (the compact wire form). The ONLY place
 * that knows this layout; everything else reads named fields. Client-safe.
 */
export const ROW = {
  icao24: 0,
  callsign: 1,
  originCountry: 2,
  timePositionS: 3,
  lastContactS: 4,
  longitude: 5,
  latitude: 6,
  baroAltitudeM: 7,
  onGround: 8,
  velocityMps: 9,
  trueTrackDeg: 10,
  verticalRateMps: 11,
  geoAltitudeM: 12,
  squawk: 13,
  spi: 14,
  positionSourceCode: 15,
} as const;

const iso = (seconds: number | null) => (seconds === null ? undefined : new Date(seconds * 1000).toISOString());
const opt = <T,>(v: T | null) => (v === null ? undefined : v);

/**
 * Entity + Observation of one aircraft row (deterministic; same IDs every
 * time). Nature `reported`: AURELIS receives state vectors published by
 * OpenSky (ADS-B/FLARM positions are broadcast by the aircraft; MLAT ones are
 * computed by OpenSky; see positionSource). observedAt = time_position.
 * Precision `approximate` (position quality is not modelled).
 */
export function rowToAircraft(
  row: AircraftRow,
  stateTime: string,
  ingestedAt: string,
): { entity: AurelisEntity; observation: AircraftObservation } {
  const icao24 = row[ROW.icao24];
  const id = aircraftEntityId(icao24);
  const observationId = `${OPENSKY_AIRCRAFT_SOURCE.id}:${icao24}:${row[ROW.timePositionS]}`;
  const location = { latitude: row[ROW.latitude], longitude: row[ROW.longitude], precision: "approximate" as const };
  const code = row[ROW.positionSourceCode];
  const data: AircraftStateData = {
    icao24,
    callsign: opt(row[ROW.callsign]),
    originCountry: opt(row[ROW.originCountry]),
    timePosition: iso(row[ROW.timePositionS]),
    lastContact: iso(row[ROW.lastContactS]),
    stateTime,
    baroAltitudeM: opt(row[ROW.baroAltitudeM]),
    geoAltitudeM: opt(row[ROW.geoAltitudeM]),
    onGround: opt(row[ROW.onGround]),
    velocityMps: opt(row[ROW.velocityMps]),
    trueTrackDeg: opt(row[ROW.trueTrackDeg]),
    verticalRateMps: opt(row[ROW.verticalRateMps]),
    squawk: opt(row[ROW.squawk]),
    spi: opt(row[ROW.spi]),
    positionSource: code === null ? undefined : POSITION_SOURCES[code],
  };
  return {
    entity: {
      id,
      category: "aviation",
      kind: "aircraft",
      label: data.callsign ?? icao24,
      location,
      locationObservationId: observationId,
    },
    observation: {
      id: observationId,
      entityId: id,
      sourceId: OPENSKY_AIRCRAFT_SOURCE.id,
      nature: "reported",
      confidence: "unknown",
      observedAt: data.timePosition,
      ingestedAt,
      location,
      data,
      sourceRecordId: icao24,
    },
  };
}
