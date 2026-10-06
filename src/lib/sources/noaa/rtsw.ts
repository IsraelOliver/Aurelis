import type {
  InterplanetaryMagneticFieldFeed,
  InterplanetaryMagneticFieldObservation,
  IntelligenceSource,
  Observation,
  RtswFeed,
  SolarWindPlasmaFeed,
  SolarWindPlasmaObservation,
} from "@/types";
import {
  NOAA_SWPC_RTSW_MAG_SOURCE,
  NOAA_SWPC_RTSW_MAG_URL,
  NOAA_SWPC_RTSW_WIND_SOURCE,
  NOAA_SWPC_RTSW_WIND_URL,
} from "./source";
import { parseTimeTag } from "./swpc-kp";

/**
 * NOAA SWPC Real-Time Solar Wind adapters (the only place that knows the
 * RTSW JSON format). Replacement products announced in SCN 26-21 (the old
 * products/solar-wind/plasma-* and mag-* files were removed ~2026-04-30).
 * Each file holds ~24 h of 1-minute samples from all available spacecraft,
 * newest first, each with `source` and `active`.
 *
 * time_tag — SOURCE FACT: "YYYY-MM-DDTHH:MM:SS" with no timezone designator.
 * AURELIS NORMALIZATION ASSUMPTION: read as UTC. Justification: SWPC's
 * real-time solar wind text products state their times in UT, SWPC's own
 * solar wind viewer parses and labels these times as UTC ("Z"), and the
 * newest samples match the files' HTTP Last-Modified (GMT) within minutes.
 * Not an explicit property of the JSON schema. Samples > 10 min in the
 * future are rejected (a sign the assumption failed).
 *
 * Units (the JSON has no unit fields): per SWPC RTSW documentation, density
 * p/cc, speed km/s, temperature K, magnetic field components and Bt in nT (GSM).
 * Quality fields (overall_quality, max_*_flag) are not used: their semantics
 * are not documented for these files.
 */

export const RTSW_WINDOW_HOURS = 6;
const MAX_FUTURE_MS = 10 * 60_000;

/** A finite number, or undefined: null, NaN and missing never become 0. */
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

type Base = { observedAt: string; spacecraft: string; active: boolean; timeTag: string };

/** Fields common to every RTSW record; null when the record is unusable. */
function base(record: unknown, nowMs: number): (Base & { r: Record<string, unknown> }) | null {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return null;
  const r = record as Record<string, unknown>;
  const observedAt = parseTimeTag(r.time_tag);
  if (!observedAt || Date.parse(observedAt) > nowMs + MAX_FUTURE_MS) return null;
  if (typeof r.source !== "string" || r.source.trim() === "") return null;
  if (typeof r.active !== "boolean") return null;
  return { observedAt, spacecraft: r.source, active: r.active, timeTag: String(r.time_tag), r };
}

/**
 * Shared normalization: validate, keep active samples only, dedupe by
 * spacecraft + time, sort by real time, pick the latest, keep the window.
 * Spacecraft changes inside the window are kept as they are (no stitching).
 */
function normalize<D extends { spacecraft: string; active: boolean }>(
  payload: unknown,
  ingestedAt: string,
  nowMs: number,
  source: IntelligenceSource,
  url: string,
  toData: (b: Base, r: Record<string, unknown>) => D | null,
): RtswFeed<Observation<D>> {
  if (!Array.isArray(payload)) throw new Error(`${source.name}: payload is not an array`);
  let rejected = 0;
  let valid = 0;
  const active = new Map<string, Observation<D>>();
  for (const record of payload) {
    const b = base(record, nowMs);
    const data = b ? toData(b, b.r) : null;
    if (!b || !data) {
      rejected++;
      continue;
    }
    valid++;
    if (!b.active) continue;
    const id = `${source.id}:${b.spacecraft}:${b.observedAt}`;
    if (active.has(id)) {
      rejected++;
      continue;
    }
    active.set(id, {
      id,
      // In situ measurement by the spacecraft; no entity, no location.
      sourceId: source.id,
      nature: "observed",
      confidence: "unknown",
      observedAt: b.observedAt,
      ingestedAt,
      data,
      sourceRecordId: `${b.spacecraft}:${b.timeTag}`,
      // No per-record URL exists: the product file.
      sourceUrl: url,
    });
  }
  if (valid === 0) throw new Error(`${source.name}: no valid record`);

  const all = [...active.values()].sort(
    (a, b) => Date.parse(a.observedAt!) - Date.parse(b.observedAt!),
  );
  const latest = all.at(-1) ?? null;
  const windowStart = latest ? Date.parse(latest.observedAt!) - RTSW_WINDOW_HOURS * 3_600_000 : 0;
  return {
    source,
    observations: all.filter((o) => Date.parse(o.observedAt!) >= windowStart),
    latestObservationId: latest?.id ?? null,
    metadata: {
      ingestedAt,
      windowHours: RTSW_WINDOW_HOURS,
      recordsReceived: payload.length,
      recordsRejected: rejected,
    },
  };
}

export function normalizeSolarWindPlasma(
  payload: unknown,
  ingestedAt: string,
  nowMs: number = Date.parse(ingestedAt),
): SolarWindPlasmaFeed {
  return normalize<SolarWindPlasmaObservation["data"]>(
    payload, ingestedAt, nowMs, NOAA_SWPC_RTSW_WIND_SOURCE, NOAA_SWPC_RTSW_WIND_URL,
    (b, r) => {
      const protonSpeedKms = num(r.proton_speed);
      const protonDensityPerCm3 = num(r.proton_density);
      const protonTemperatureK = num(r.proton_temperature);
      // A sample with none of the three measurements carries nothing to show.
      if (protonSpeedKms === undefined && protonDensityPerCm3 === undefined && protonTemperatureK === undefined) {
        return null;
      }
      return { protonSpeedKms, protonDensityPerCm3, protonTemperatureK, spacecraft: b.spacecraft, active: b.active };
    },
  );
}

export function normalizeInterplanetaryMagneticField(
  payload: unknown,
  ingestedAt: string,
  nowMs: number = Date.parse(ingestedAt),
): InterplanetaryMagneticFieldFeed {
  return normalize<InterplanetaryMagneticFieldObservation["data"]>(
    payload, ingestedAt, nowMs, NOAA_SWPC_RTSW_MAG_SOURCE, NOAA_SWPC_RTSW_MAG_URL,
    (b, r) => {
      const bzGsmNt = num(r.bz_gsm);
      const btNt = num(r.bt);
      if (bzGsmNt === undefined && btNt === undefined) return null;
      return {
        bzGsmNt,
        btNt,
        bxGsmNt: num(r.bx_gsm),
        byGsmNt: num(r.by_gsm),
        spacecraft: b.spacecraft,
        active: b.active,
      };
    },
  );
}

async function fetchJson(url: string, label: string): Promise<unknown> {
  // Files are ~2–3 MB: never put into Next's data cache.
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${label} responded ${response.status}`);
  return response.json();
}

export async function fetchSolarWindPlasma(): Promise<SolarWindPlasmaFeed> {
  const payload = await fetchJson(NOAA_SWPC_RTSW_WIND_URL, "NOAA SWPC RTSW wind");
  return normalizeSolarWindPlasma(payload, new Date().toISOString());
}

export async function fetchInterplanetaryMagneticField(): Promise<InterplanetaryMagneticFieldFeed> {
  const payload = await fetchJson(NOAA_SWPC_RTSW_MAG_URL, "NOAA SWPC RTSW mag");
  return normalizeInterplanetaryMagneticField(payload, new Date().toISOString());
}
