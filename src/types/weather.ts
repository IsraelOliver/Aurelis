import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * Open-Meteo point weather (Forecast API, Best Match). Model-derived values for
 * a user-chosen coordinate: no Entity (a clicked point is not a tracked thing),
 * never "observed". Units are the API defaults, verified on every response.
 * A value the response does not give stays undefined, never 0.
 */

/** Current conditions (`current`): 15-minutely model data valid at `current.time`. */
export interface WeatherCurrentData {
  temperatureC?: number;
  apparentTemperatureC?: number;
  relativeHumidityPercent?: number;
  cloudCoverPercent?: number;
  precipitationMm?: number;
  /** WMO weather interpretation code, only when in the documented table. */
  weatherCode?: number;
  pressureMslHpa?: number;
  windSpeedKmh?: number;
  /** Degrees, as returned. */
  windDirectionDegrees?: number;
  windGustsKmh?: number;
  /** `current.interval`, seconds (Open-Meteo: current = 15-minutely model data). */
  intervalSeconds?: number;
}

/** One hourly value (`hourly`), valid at that hour. */
export interface WeatherHourlyData {
  temperatureC?: number;
  cloudCoverPercent?: number;
  precipitationProbabilityPercent?: number;
  precipitationMm?: number;
  weatherCode?: number;
  windSpeedKmh?: number;
}

export type WeatherCurrentObservation = Observation<WeatherCurrentData>;
export type WeatherHourlyObservation = Observation<WeatherHourlyData>;

/** Normalized point forecast, as served by /api/weather/forecast. No entities. */
export interface WeatherPointFeed {
  source: IntelligenceSource;
  /** Coordinate the user chose (the query), kept as is. */
  requestedLocation: { latitude: number; longitude: number };
  /**
   * Response `latitude`/`longitude`/`elevation`. Open-Meteo: "WGS84 of the
   * center of the weather grid-cell which was used to generate this forecast",
   * possibly a few km away; elevation = 90 m DEM height used for downscaling.
   */
  gridCell: { latitude: number; longitude: number; elevationM?: number };
  /** Open-Meteo does not report which upstream model Best Match used. */
  model: "best_match";
  current: WeatherCurrentObservation;
  /** 24 hourly values from the current hour, oldest first. */
  hourly: WeatherHourlyObservation[];
  metadata: {
    ingestedAt: IsoDateTime;
    forecastHours: number;
  };
}
