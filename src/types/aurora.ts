import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * One OVATION grid cell, normalized: [longitude −180..180, latitude −90..90,
 * auroraValue]. A compact tuple (tens of thousands of cells per snapshot).
 * `auroraValue` is the source's "Aurora" value as published: NOAA does not
 * document its unit or scale for this JSON (not called a probability here).
 */
export type AuroraGridCell = [lon: number, lat: number, auroraValue: number];

/**
 * NOAA SWPC OVATION aurora forecast payload (Observation.data). One forecast
 * snapshot of a continuous modeled field: no Entity, no single location.
 */
export interface AuroraForecastData {
  /**
   * Source field "Observation Time", as published (explicit UTC). Its exact
   * meaning is not documented for this JSON; it is not an observation of the
   * aurora. Kept here instead of Observation.observedAt.
   */
  inputObservationTime: IsoDateTime;
  /** Source field "Forecast Time" (explicit UTC); also Observation.validAt. */
  forecastTime: IsoDateTime;
  /** Source field "Data Format", e.g. "[Longitude, Latitude, Aurora]". */
  dataFormat: string;
  /** Valid grid cells in the payload, zeros included. */
  totalGridCells: number;
  /** Valid cells with auroraValue > 0. */
  activeGridCells: number;
  /** Cells rejected by validation (malformed, out of range, duplicate). */
  rejectedGridCells: number;
  /** Highest auroraValue in the grid (unit not documented). */
  peakValue: number;
  /**
   * Only cells with auroraValue > 0 (transfer/rendering optimization). Every
   * valid cell not listed here has value 0: zero, never missing.
   */
  activeCells: AuroraGridCell[];
}

export type AuroraForecastObservation = Observation<AuroraForecastData>;

/** Normalized OVATION snapshot, as served by /api/space/weather/aurora. No entities. */
export interface AuroraForecastFeed {
  source: IntelligenceSource;
  observation: AuroraForecastObservation;
  metadata: {
    /** When the AURELIS server received the response. */
    ingestedAt: IsoDateTime;
  };
}
