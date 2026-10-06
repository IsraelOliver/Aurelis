import type { EonetEventObservation } from "@/types";

/**
 * EONET VIEW filters (client-side, visualization only). They decide which
 * ingested events the EONET map layer draws; they never change ingestion,
 * snapshots, Entities, Observations, SOURCES, ENTITIES, SourceHealth or the
 * OPEN IN EONET status. DATA EXISTS ≠ MATCHES CURRENT VIEW FILTER ≠ IS DRAWN.
 *
 * Recency uses ONLY the date of the event's latest EONET geometry (EONET:
 * "most likely 00:00Z unless the source provided a particular time"), not the
 * event start, closing, ingestion or any observation time. An open event whose
 * latest geometry is older than the window is simply not in this view; AURELIS
 * does not decide that it ended.
 */
export type EonetRecency = "7d" | "30d" | "90d" | "all";

export interface EonetViewFilters {
  recency: EonetRecency;
  /** EONET category id, or null for ALL. */
  categoryId: string | null;
}

export const DEFAULT_EONET_FILTERS: EonetViewFilters = { recency: "30d", categoryId: null };

export const RECENCY_OPTIONS: { value: EonetRecency; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "ALL OPEN" },
];

const DAY_MS = 86_400_000;
const RECENCY_DAYS: Record<EonetRecency, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

export const isDefaultEonetFilters = (f: EonetViewFilters) =>
  f.recency === DEFAULT_EONET_FILTERS.recency && f.categoryId === DEFAULT_EONET_FILTERS.categoryId;

/** Date (ms) of the event's latest geometry, as chosen at ingestion. */
export function latestGeometryTime(o: EonetEventObservation): number {
  return Date.parse(o.data.geometries[o.data.latestGeometryIndex]?.date ?? "");
}

/**
 * Category AND recency. Category: the event has that id among ANY of its
 * categories (no primary category). Recency: latest geometry date ≥
 * referenceMs − window (inclusive at the boundary); "all" = no time limit.
 */
export function matchesEonetFilters(o: EonetEventObservation, f: EonetViewFilters, referenceMs: number): boolean {
  if (f.categoryId !== null && !o.data.categories.some((c) => c.id === f.categoryId)) return false;
  const days = RECENCY_DAYS[f.recency];
  if (days === null) return true;
  const t = latestGeometryTime(o);
  return Number.isFinite(t) && t >= referenceMs - days * DAY_MS;
}

/** New array of the observations in the current view; the input is not modified. */
export function filterEonet(
  observations: EonetEventObservation[],
  f: EonetViewFilters,
  referenceMs: number,
): EonetEventObservation[] {
  return observations.filter((o) => matchesEonetFilters(o, f, referenceMs));
}

/** Categories present in the snapshot with their total counts (all ingested events; no ranking semantics). */
export function eonetCategories(observations: EonetEventObservation[]): { id: string; title: string; count: number }[] {
  const byId = new Map<string, { id: string; title: string; count: number }>();
  for (const o of observations) {
    for (const c of o.data.categories) {
      const entry = byId.get(c.id) ?? { id: c.id, title: c.title, count: 0 };
      entry.count++;
      byId.set(c.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Whether a selected EONET entity must be released: it no longer passes the
 * view filters (its panel would describe something not drawn).
 */
export function selectionHiddenByFilters(selectedEntityId: string | null, visibleEntityIds: Set<string>, prefix: string): boolean {
  return selectedEntityId !== null && selectedEntityId.startsWith(prefix) && !visibleEntityIds.has(selectedEntityId);
}
