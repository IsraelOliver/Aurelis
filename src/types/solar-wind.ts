import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * NOAA SWPC Real-Time Solar Wind (RTSW): in situ measurements by spacecraft
 * upstream of Earth (typically near L1). Global context, not geographic: no
 * Entity (the spacecraft are not tracked objects here) and no location.
 * A measurement the source did not provide stays undefined, never 0.
 */

/** One plasma sample (rtsw_wind_1m.json). Units per SWPC RTSW documentation. */
export interface SolarWindPlasmaData {
  /** `proton_speed`, km/s. */
  protonSpeedKms?: number;
  /** `proton_density`, protons per cm³ (SWPC: "p/cc"). */
  protonDensityPerCm3?: number;
  /** `proton_temperature`, kelvin. */
  protonTemperatureK?: number;
  /** `source`: spacecraft the sample came from, as published (e.g. "SOLAR1", "ACE"). */
  spacecraft: string;
  /** `active`: whether SWPC forecasters considered this spacecraft active at the time. */
  active: boolean;
}

/** One interplanetary magnetic field sample (rtsw_mag_1m.json), GSM, nT. */
export interface InterplanetaryMagneticFieldData {
  /** `bz_gsm`: north/south component (negative = southward). */
  bzGsmNt?: number;
  /** `bt`: total field magnitude. */
  btNt?: number;
  bxGsmNt?: number;
  byGsmNt?: number;
  spacecraft: string;
  active: boolean;
}

export type SolarWindPlasmaObservation = Observation<SolarWindPlasmaData>;
export type InterplanetaryMagneticFieldObservation = Observation<InterplanetaryMagneticFieldData>;

/** Normalized RTSW snapshot (one per feed): active samples of the recent window. No entities. */
export interface RtswFeed<O> {
  source: IntelligenceSource;
  /** Samples with active === true in the window, oldest first. May span several spacecraft. */
  observations: O[];
  /** Active sample with the greatest observedAt (not the array position). */
  latestObservationId: string | null;
  metadata: {
    ingestedAt: IsoDateTime;
    windowHours: number;
    recordsReceived: number;
    recordsRejected: number;
  };
}

export type SolarWindPlasmaFeed = RtswFeed<SolarWindPlasmaObservation>;
export type InterplanetaryMagneticFieldFeed = RtswFeed<InterplanetaryMagneticFieldObservation>;
