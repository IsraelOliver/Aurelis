import type {
  GoesXrayFeed,
  GoesXrayFlareObservation,
  GoesXrayFluxObservation,
} from "@/types";
import {
  NOAA_SWPC_GOES_XRAY_FLARE_URL,
  NOAA_SWPC_GOES_XRAY_FLUX_URL,
  NOAA_SWPC_GOES_XRAY_SOURCE,
} from "./source";

/**
 * NOAA SWPC GOES X-ray adapter (primary operational feed): the only place
 * that knows these JSON formats. Product page:
 * https://www.swpc.noaa.gov/products/goes-x-ray-flux
 *
 * xrays-6-hour.json: 1-minute averages, records
 *   { time_tag "…Z", satellite (GOES number), flux, observed_flux,
 *     electron_correction, electron_contaminaton, energy "0.1-0.8nm" | "0.05-0.4nm" }.
 *   `flux` (W/m²) is used: it equals observed_flux − electron_correction and
 *   is the value matching SWPC's official classes (e.g. C1.7 ↔ 1.77e-6). The
 *   other fields' semantics are not documented on the product page; they are
 *   not used. A flux ≤ 0 (published with electron_contaminaton true) is not a
 *   measurement of zero X-rays: it is dropped, never shown as 0.
 * xray-flares-latest.json: [] or one record, the latest X-ray event "detected
 *   by the GOES satellites, either automatically or manually entered", with
 *   begin/max/end times and classes as SWPC defines them.
 *
 * Times carry an explicit zone ("Z"): no assumption needed.
 * Primary satellite is whatever the payload says (instrument-sources.json maps
 * it and it changes); no fallback to secondary here.
 */

export const XRAY_WINDOW_HOURS = 6;
const LONG_BAND = "0.1-0.8nm";
const MAX_FUTURE_MS = 10 * 60_000;
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function zoned(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

const isGoesNumber = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

/** Flux samples: long band only, valid, latest by timestamp, 6 h window. */
export function normalizeGoesXrayFlux(
  payload: unknown,
  ingestedAt: string,
  nowMs: number = Date.parse(ingestedAt),
): Pick<GoesXrayFeed, "flux" | "latestFluxId"> & { received: number; rejected: number } {
  if (!Array.isArray(payload)) throw new Error("GOES X-ray flux payload is not an array");
  const samples = new Map<string, GoesXrayFluxObservation>();
  let rejected = 0;
  for (const record of payload) {
    if (typeof record !== "object" || record === null) {
      rejected++;
      continue;
    }
    const r = record as Record<string, unknown>;
    if (r.energy === "0.05-0.4nm") continue; // valid short-band sample, not used in AURELIS
    const observedAt = zoned(r.time_tag);
    const flux = r.flux;
    if (
      r.energy !== LONG_BAND ||
      !observedAt ||
      Date.parse(observedAt) > nowMs + MAX_FUTURE_MS ||
      !isGoesNumber(r.satellite) ||
      typeof flux !== "number" ||
      !Number.isFinite(flux) ||
      flux <= 0
    ) {
      rejected++;
      continue;
    }
    const id = `${NOAA_SWPC_GOES_XRAY_SOURCE.id}:${r.satellite}:${LONG_BAND}:${observedAt}`;
    if (samples.has(id)) {
      rejected++;
      continue;
    }
    samples.set(id, {
      id,
      // Instrument measurement; no entity, no location.
      sourceId: NOAA_SWPC_GOES_XRAY_SOURCE.id,
      nature: "observed",
      confidence: "unknown",
      observedAt,
      ingestedAt,
      data: { fluxWattsPerM2: flux, energyBand: LONG_BAND, satellite: r.satellite },
      sourceRecordId: `GOES-${r.satellite}:${LONG_BAND}:${String(r.time_tag)}`,
      sourceUrl: NOAA_SWPC_GOES_XRAY_FLUX_URL,
    });
  }
  const all = [...samples.values()].sort((a, b) => Date.parse(a.observedAt!) - Date.parse(b.observedAt!));
  if (all.length === 0) throw new Error("GOES X-ray flux payload has no valid long-band sample");
  const latest = all[all.length - 1];
  const start = Date.parse(latest.observedAt!) - XRAY_WINDOW_HOURS * 3_600_000;
  return {
    flux: all.filter((o) => Date.parse(o.observedAt!) >= start),
    latestFluxId: latest.id,
    received: payload.length,
    rejected,
  };
}

/**
 * Latest official X-ray event, or null when the product lists none. The class
 * is SWPC's `max_class`; it is never inferred from the flux series.
 */
export function normalizeGoesXrayFlare(payload: unknown, ingestedAt: string): GoesXrayFlareObservation | null {
  if (!Array.isArray(payload)) throw new Error("GOES X-ray flare payload is not an array");
  // Not assuming order: the event with the latest begin time.
  let best: GoesXrayFlareObservation | null = null;
  for (const record of payload) {
    if (typeof record !== "object" || record === null) continue;
    const r = record as Record<string, unknown>;
    const beginTime = zoned(r.begin_time);
    const peakTime = zoned(r.max_time);
    const flareClass = typeof r.max_class === "string" && /^[ABCMX]\d+(\.\d+)?$/.test(r.max_class) ? r.max_class : null;
    if (!beginTime || !peakTime || !flareClass || !isGoesNumber(r.satellite)) continue;
    const endTime = zoned(r.end_time) ?? undefined;
    const peak = typeof r.max_xrlong === "number" && Number.isFinite(r.max_xrlong) && r.max_xrlong > 0 ? r.max_xrlong : undefined;
    const observation: GoesXrayFlareObservation = {
      id: `${NOAA_SWPC_GOES_XRAY_SOURCE.id}:flare:${r.satellite}:${beginTime}`,
      sourceId: NOAA_SWPC_GOES_XRAY_SOURCE.id,
      // An event determined by SWPC (detection algorithm or forecaster) from the
      // measurements: a report about the flux, not the measurement itself.
      nature: "reported",
      confidence: "unknown",
      // The event peak (which defines its class). No publication time is given.
      observedAt: peakTime,
      ingestedAt,
      data: { flareClass, beginTime, peakTime, endTime, peakFluxWattsPerM2: peak, satellite: r.satellite },
      sourceRecordId: `GOES-${r.satellite}:event:${String(r.begin_time)}`,
      sourceUrl: NOAA_SWPC_GOES_XRAY_FLARE_URL,
    };
    if (!best || Date.parse(beginTime) > Date.parse(best.data.beginTime)) best = observation;
  }
  return best;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`NOAA SWPC GOES X-ray responded ${response.status} (${url})`);
  return response.json();
}

/**
 * Flux (required) and latest event (auxiliary file of the same product) in
 * parallel. The snapshot fails only when the flux fails; an unreadable event
 * file is reported as such, never as "no flare".
 */
export async function fetchGoesXray(): Promise<GoesXrayFeed> {
  const [fluxResult, flareResult] = await Promise.allSettled([
    fetchJson(NOAA_SWPC_GOES_XRAY_FLUX_URL),
    fetchJson(NOAA_SWPC_GOES_XRAY_FLARE_URL),
  ]);
  if (fluxResult.status === "rejected") throw fluxResult.reason;
  const ingestedAt = new Date().toISOString();
  const flux = normalizeGoesXrayFlux(fluxResult.value, ingestedAt);
  let latestFlare: GoesXrayFlareObservation | null = null;
  let flareProduct: "ok" | "unavailable" = "unavailable";
  if (flareResult.status === "fulfilled") {
    try {
      latestFlare = normalizeGoesXrayFlare(flareResult.value, ingestedAt);
      flareProduct = "ok";
    } catch {
      flareProduct = "unavailable";
    }
  }
  return {
    source: NOAA_SWPC_GOES_XRAY_SOURCE,
    flux: flux.flux,
    latestFluxId: flux.latestFluxId,
    latestFlare,
    metadata: {
      ingestedAt,
      windowHours: XRAY_WINDOW_HOURS,
      recordsReceived: flux.received,
      recordsRejected: flux.rejected,
      flareProduct,
    },
  };
}
