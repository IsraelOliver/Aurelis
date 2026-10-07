import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

export type AircraftPositionSource = "ADS-B" | "ASTERIX" | "MLAT" | "FLARM";

/**
 * One OpenSky state vector (Observation.data), documented fields only, in
 * the source's SI units (names carry the unit). Absent/null/invalid values are
 * left undefined: never 0, never false by default. No registration, aircraft
 * type, route or airline: /states/all does not provide them.
 */
export interface AircraftStateData {
  /** ICAO 24-bit transponder address, lowercase hex. */
  icao24: string;
  /** Callsign, trimmed (the source pads it to 8 characters). */
  callsign?: string;
  /** OpenSky "origin_country": country inferred from the ICAO 24-bit address, not the aircraft's location or route. */
  originCountry?: string;
  /** Last position update (source time_position). Also Observation.observedAt. */
  timePosition?: IsoDateTime;
  /** Last message of any kind received from the transponder (source last_contact). */
  lastContact?: IsoDateTime;
  /** Time the response's state vectors are associated with (source "time"; vectors cover [time − 1 s, time]). */
  stateTime: IsoDateTime;
  baroAltitudeM?: number;
  geoAltitudeM?: number;
  onGround?: boolean;
  /** Speed over ground. */
  velocityMps?: number;
  /** Degrees clockwise from north (0° = north). */
  trueTrackDeg?: number;
  /** Positive = climbing, negative = descending. */
  verticalRateMps?: number;
  squawk?: string;
  /** Special purpose indicator. */
  spi?: boolean;
  positionSource?: AircraftPositionSource;
}

export type AircraftObservation = Observation<AircraftStateData>;

/**
 * Compact wire form of one aircraft with a current position (one per row,
 * thousands per snapshot). Same values as the state vector (SI, untouched),
 * minus the unused receiver list; null = absent. Layout in
 * src/lib/sources/opensky/rows.ts (ROW); Entities/Observations are derived
 * from it deterministically (rowToAircraft), so the payload carries no copies.
 */
export type AircraftRow = [
  icao24: string,
  callsign: string | null,
  originCountry: string | null,
  timePositionS: number,
  lastContactS: number | null,
  longitude: number,
  latitude: number,
  baroAltitudeM: number | null,
  onGround: boolean | null,
  velocityMps: number | null,
  trueTrackDeg: number | null,
  verticalRateMps: number | null,
  geoAltitudeM: number | null,
  squawk: string | null,
  spi: boolean | null,
  positionSourceCode: number | null,
];

/**
 * The current GLOBAL OpenSky snapshot, as served by /api/air/aircraft: the
 * complete current collection (replaced by every snapshot, no history). Only
 * aircraft with a valid, recent position are rows; the rest are counted.
 */
export interface AirTrafficFeed {
  source: IntelligenceSource;
  scope: "global";
  aircraft: AircraftRow[];
  metadata: {
    ingestedAt: IsoDateTime;
    /** Source "time" of the response. */
    stateTime: IsoDateTime;
    /** State vectors in the response (after de-duplication by ICAO24). */
    totalStates: number;
    /** Without a valid position: counted, not drawn, not Entities. */
    withoutPosition: number;
    /** Position older than maxPositionAgeS (AURELIS policy): counted, not drawn. */
    stalePosition: number;
    maxPositionAgeS: number;
    /** Malformed vectors discarded. */
    rejected: number;
    /** OpenSky X-Rate-Limit-Remaining after this request, when sent. */
    creditsRemaining: number | null;
    /** Documented cost of this request (global → 4). */
    creditsPerRequest: number;
    /** Cost observed between this and the previous server request, when measurable. */
    observedCreditsPerRequest: number | null;
  };
}
