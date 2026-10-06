import type { PlanetaryKpFeed, PlanetaryKpObservation } from "@/types";
import { NOAA_SWPC_KP_SOURCE, NOAA_SWPC_KP_URL } from "./source";

/**
 * NOAA SWPC planetary Kp adapter: the only place that knows its JSON format.
 * Product: https://www.swpc.noaa.gov/products/planetary-k-index (updates every
 * minute; public domain, no key). Records: { time_tag, kp_index, estimated_kp, kp }.
 */

/** Window kept, relative to the latest valid sample. */
export const KP_WINDOW_HOURS = 6;

/** Kp is defined on 0–9 (SWPC: "an integer in the range 0-9"; estimates come in thirds). */
const KP_MIN = 0;
const KP_MAX = 9;

/**
 * Source fact: `time_tag` is "YYYY-MM-DDTHH:MM:SS" and omits an explicit
 * timezone designator; the JSON schema does not state its zone.
 * Normalization assumption: AURELIS interprets it as UTC, following SWPC's
 * operational time conventions (SWPC products and materials use UTC /
 * Universal Time). This is a documented AURELIS assumption, not an explicit
 * property of the schema.
 */
const TIME_TAG = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

/** A sample this far in the future means the time zone assumption is wrong: rejected. */
const MAX_FUTURE_MS = 10 * 60_000;

export async function fetchPlanetaryKp(): Promise<PlanetaryKpFeed> {
  const response = await fetch(NOAA_SWPC_KP_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`NOAA SWPC responded ${response.status}`);
  }
  const payload: unknown = await response.json();
  return normalizePlanetaryKp(payload, new Date().toISOString());
}

/** "2026-10-06T12:41:00" → "2026-10-06T12:41:00.000Z", or null when malformed/impossible. */
export function parseTimeTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = TIME_TAG.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const date = new Date(ms);
  // Reject rolled-over values such as month 13 or 25:00.
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || date.getUTCHours() !== h) return null;
  return date.toISOString();
}

/**
 * Validates and normalizes the payload. Invalid records are skipped one by
 * one; an invalid payload (not an array, or no valid record) throws.
 */
export function normalizePlanetaryKp(
  payload: unknown,
  ingestedAt: string,
  nowMs: number = Date.parse(ingestedAt),
): PlanetaryKpFeed {
  if (!Array.isArray(payload)) throw new Error("Kp payload is not an array");

  const byTime = new Map<string, PlanetaryKpObservation>();
  let rejected = 0;
  for (const record of payload) {
    const observation = toObservation(record, ingestedAt, nowMs);
    if (observation && observation.observedAt) {
      // Duplicate time_tag: keep the first occurrence.
      if (!byTime.has(observation.observedAt)) byTime.set(observation.observedAt, observation);
      else rejected++;
    } else {
      rejected++;
    }
  }
  if (byTime.size === 0) throw new Error("Kp payload has no valid record");

  // Order by the real timestamp, never by array position.
  const all = [...byTime.values()].sort(
    (a, b) => Date.parse(a.observedAt!) - Date.parse(b.observedAt!),
  );
  const latest = all[all.length - 1];
  const windowStart = Date.parse(latest.observedAt!) - KP_WINDOW_HOURS * 3_600_000;
  const observations = all.filter((o) => Date.parse(o.observedAt!) >= windowStart);

  return {
    source: NOAA_SWPC_KP_SOURCE,
    observations,
    latestObservationId: latest.id,
    metadata: {
      ingestedAt,
      windowHours: KP_WINDOW_HOURS,
      recordsReceived: payload.length,
      recordsRejected: rejected,
    },
  };
}

function toObservation(
  record: unknown,
  ingestedAt: string,
  nowMs: number,
): PlanetaryKpObservation | null {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return null;
  const r = record as Record<string, unknown>;

  const observedAt = parseTimeTag(r.time_tag);
  if (!observedAt || Date.parse(observedAt) > nowMs + MAX_FUTURE_MS) return null;
  const estimatedKp = r.estimated_kp;
  if (typeof estimatedKp !== "number" || !Number.isFinite(estimatedKp)) return null;
  if (estimatedKp < KP_MIN || estimatedKp > KP_MAX) return null;

  return {
    id: `${NOAA_SWPC_KP_SOURCE.id}:${observedAt}`,
    // A planetary index: no entity and no location.
    sourceId: NOAA_SWPC_KP_SOURCE.id,
    // Derived by SWPC from ground magnetometer data in near real time: an estimate, not a measurement.
    nature: "estimated",
    confidence: "unknown",
    // The minute the estimate applies to. The source gives no publication time (no reportedAt).
    observedAt,
    ingestedAt,
    data: {
      estimatedKp,
      kpIndex: typeof r.kp_index === "number" && Number.isFinite(r.kp_index) ? r.kp_index : undefined,
      kpCode: typeof r.kp === "string" && r.kp !== "" ? r.kp : undefined,
    },
    sourceRecordId: String(r.time_tag),
    // No per-record URL exists: the product endpoint.
    sourceUrl: NOAA_SWPC_KP_URL,
  };
}
