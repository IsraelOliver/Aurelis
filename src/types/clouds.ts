import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * NOAA GFS total cloud cover: ONE model field (one run, one forecast step)
 * for the whole globe. Observation.data carries its metadata; the grid itself
 * is served separately as a compact binary (see CloudCoverGridInfo). No
 * Entity, no location, no Observation per grid cell.
 */
export interface CloudCoverData {
  model: "NOAA GFS";
  /** GRIB2 short name and level, as in the GFS inventory. */
  field: "TCDC:entire atmosphere";
  description: "Total cloud cover, entire atmosphere";
  unit: "%";
  /** Model run (reference) time, UTC. */
  runTime: IsoDateTime;
  /** Hours after runTime (0 = initial state). */
  forecastHour: number;
  /** runTime + forecastHour (also Observation.validAt). */
  validAt: IsoDateTime;
  resolutionDeg: 0.25;
  width: number;
  height: number;
  /** Cells with a value (0–100 %). */
  validCells: number;
  /** Cells without a value (never counted as 0 % / clear sky). */
  noDataCells: number;
  /** Mean over valid cells, unweighted by area (summary only). */
  meanPercent: number | null;
}

export type CloudCoverObservation = Observation<CloudCoverData>;

/**
 * How to read the binary grid served at `url`: little-endian uint16, row-major,
 * row 0 = 90°N, column 0 = 0°E (then eastwards), steps of 0.25°; each value is
 * tenths of a percent (0–1000) or `noDataValue`.
 */
export interface CloudCoverGridInfo {
  /** Stable id of the field (run + step); the grid at `url` never changes for an id. */
  id: string;
  url: string;
  encoding: "uint16le-tenths-percent";
  width: number;
  height: number;
  firstLatDeg: 90;
  firstLonDeg: 0;
  latStepDeg: -0.25;
  lonStepDeg: 0.25;
  noDataValue: 65535;
  byteLength: number;
}

/** Served by /api/weather/clouds (metadata only; the grid is fetched once per id). */
export interface CloudCoverFeed {
  source: IntelligenceSource;
  observation: CloudCoverObservation;
  grid: CloudCoverGridInfo;
  metadata: {
    /** When the AURELIS server downloaded and decoded this field. */
    ingestedAt: IsoDateTime;
    /** When the server last confirmed this is still the best available field. */
    checkedAt: IsoDateTime;
  };
}
