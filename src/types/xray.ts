import type { IsoDateTime } from "./common";
import type { Observation } from "./observation";
import type { IntelligenceSource } from "./source";

/**
 * NOAA SWPC GOES X-ray (primary operational feed): full-Sun soft X-ray flux
 * measured by the GOES XRS. Global, non-geographic: no Entity (neither the
 * Sun nor the satellite), no location, nothing on the map.
 */

/** One 1-minute flux sample (xrays-6-hour.json), long band 0.1–0.8 nm. */
export interface GoesXrayFluxData {
  /** `flux`, W/m² (the value matching SWPC's official flare classes). */
  fluxWattsPerM2: number;
  /** `energy` as published, e.g. "0.1-0.8nm". */
  energyBand: string;
  /** `satellite` as published (GOES number, e.g. 18); never hardcoded. */
  satellite: number;
}

/**
 * The latest X-ray event (xray-flares-latest.json): detected by SWPC's
 * algorithm or entered manually by a forecaster. Official class and times
 * as published; never recomputed from the flux.
 */
export interface GoesXrayFlareData {
  /** `max_class`: class at the event maximum (the event's class), e.g. "M1.4". */
  flareClass: string;
  /** `begin_time`: first minute of 4 minutes of steep monotonic increase (0.1–0.8 nm). */
  beginTime: IsoDateTime;
  /** `max_time`: minute of the peak flux. */
  peakTime: IsoDateTime;
  /** `end_time`: flux halfway back to the pre-flare background; absent while not reported. */
  endTime?: IsoDateTime;
  /** `max_xrlong`: peak 0.1–0.8 nm flux, W/m². */
  peakFluxWattsPerM2?: number;
  satellite: number;
}

export type GoesXrayFluxObservation = Observation<GoesXrayFluxData>;
export type GoesXrayFlareObservation = Observation<GoesXrayFlareData>;

/** Normalized GOES X-ray snapshot, as served by /api/space/weather/xray. No entities. */
export interface GoesXrayFeed {
  source: IntelligenceSource;
  /** Long-band (0.1–0.8 nm) samples of the window, oldest first. */
  flux: GoesXrayFluxObservation[];
  /** Sample with the greatest observedAt (not the array position). */
  latestFluxId: string | null;
  /** Latest official X-ray event, or null when the product lists none. */
  latestFlare: GoesXrayFlareObservation | null;
  metadata: {
    ingestedAt: IsoDateTime;
    windowHours: number;
    recordsReceived: number;
    recordsRejected: number;
    /** Whether the latest-event file could be read (it is auxiliary to the flux). */
    flareProduct: "ok" | "unavailable";
  };
}
