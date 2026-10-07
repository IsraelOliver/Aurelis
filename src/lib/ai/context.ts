import {
  airCapsule,
  disastersCapsule,
  focusCapsule,
  spaceCapsule,
  t,
  weatherCapsule,
  type CapsuleData,
  type CapsuleLimits,
} from "./capsules";
import { estimateTokens, type AiDomain, type AiRoute, type AiSourceState } from "./types";

/**
 * Context Builder: assembles ONLY what the route asks for, within its budget.
 * Over budget → fewer list items → brief text → drop the lowest-priority
 * capsules (last named domain first). Deterministic: same input → same JSON.
 */

export interface SmileyContextInput extends CapsuleData {
  nowMs: number;
  selectedEntityId: string | null;
  sources: AiSourceState[];
}

export interface BuiltContext {
  /** null = nothing operational to send (greeting, general, personal…). */
  context: Record<string, unknown> | null;
  /** serializeContext(context), or null. */
  json: string | null;
  bytes: number;
  estimatedTokens: number;
  domains: AiDomain[];
  focus: boolean;
  /** Capsules left out to respect the budget. */
  dropped: AiDomain[];
}

const LEVELS: CapsuleLimits[] = [
  { listItems: 8, weatherHours: 6, brief: false },
  { listItems: 5, weatherHours: 4, brief: false },
  { listItems: 3, weatherHours: 3, brief: true },
  { listItems: 1, weatherHours: 2, brief: true },
];

const SOURCE_DOMAIN = (id: string): AiDomain | null =>
  id.startsWith("noaa-swpc") || id === "wtia-iss"
    ? "space"
    : id === "usgs-earthquakes" || id === "nasa-eonet"
      ? "disasters"
      : id === "open-meteo-weather" || id === "noaa-gfs-clouds"
        ? "weather"
        : id === "opensky-aircraft"
          ? "air"
          : null;

/** Only the included domains' sources; fresh ones collapse into one word. */
function healthSummary(sources: AiSourceState[], domains: AiDomain[]) {
  const relevant = sources.filter((s) => {
    const d = SOURCE_DOMAIN(s.id);
    return d !== null && domains.includes(d);
  });
  if (relevant.length === 0) return undefined;
  const notFresh = relevant
    .filter((s) => s.health !== "fresh")
    .map((s) => `${s.name}: ${s.health}${s.snapshotAgeMs !== null ? ` (${Math.round(s.snapshotAgeMs / 60_000)} min old)` : ""}`);
  return notFresh.length ? { notFresh, others: "fresh" } : "all fresh";
}

/** Context keys: explicit names ("air" alone reads as air quality). */
const CAPSULE_KEY: Record<AiDomain, string> = { space: "space", disasters: "disasters", weather: "weather", air: "airTraffic" };

/** Said instead of guessed when a named domain has no data in AURELIS. */
const NOT_LOADED: Record<AiDomain, string> = {
  space: "no space data loaded in AURELIS",
  disasters: "no disaster data loaded in AURELIS",
  weather: "no weather point inspected and global clouds not loaded in AURELIS",
  air: "air traffic (OpenSky) not loaded: AIR has not been opened in this session",
};

function capsuleFor(domain: AiDomain, input: SmileyContextInput, lim: CapsuleLimits) {
  switch (domain) {
    case "space":
      return spaceCapsule(input);
    case "disasters":
      return disastersCapsule(input, lim);
    case "weather":
      return weatherCapsule(input, lim, input.nowMs);
    case "air":
      return airCapsule(input, input.nowMs);
  }
}

function assemble(input: SmileyContextInput, route: AiRoute, domains: AiDomain[], lim: CapsuleLimits, dropped: AiDomain[]) {
  const ctx: Record<string, unknown> = { at: t(new Date(input.nowMs).toISOString()), intent: route.intent };
  if (route.includeFocus) ctx.focus = focusCapsule(input.selectedEntityId, input, lim.brief);
  else if (route.intent === "focus") {
    ctx.focus = null;
    ctx.note = "Nothing is selected in AURELIS.";
  }
  for (const d of domains) ctx[CAPSULE_KEY[d]] = capsuleFor(d, input, lim) ?? NOT_LOADED[d];
  if (route.includeSourceHealth && domains.length) {
    const health = healthSummary(input.sources, domains);
    if (health) ctx.sourceHealth = health;
  }
  if (dropped.length) ctx.omittedForBudget = dropped;
  return ctx;
}

/** Serialized for the model: `<` escaped so source text can never close the context delimiter. */
export function serializeContext(context: unknown): string {
  return JSON.stringify(context).replace(/</g, "\\u003c");
}

export const contextBytes = (json: string) => new TextEncoder().encode(json).length;

export function buildSmileyContext(input: SmileyContextInput, route: AiRoute): BuiltContext {
  if (route.domains.length === 0 && route.intent !== "focus") {
    return { context: null, json: null, bytes: 0, estimatedTokens: 0, domains: [], focus: false, dropped: [] };
  }
  const domains = [...route.domains];
  const dropped: AiDomain[] = [];
  const startLevel = route.intent === "global_situational" ? 1 : 0;
  for (;;) {
    let last: { ctx: Record<string, unknown>; json: string } | null = null;
    for (let level = startLevel; level < LEVELS.length; level++) {
      const ctx = assemble(input, route, domains, LEVELS[level], dropped);
      const json = serializeContext(ctx);
      last = { ctx, json };
      if (estimateTokens(json) <= route.budgetTokens) break;
    }
    const fits = estimateTokens(last!.json) <= route.budgetTokens;
    if (fits || domains.length <= 1) {
      return {
        context: last!.ctx,
        json: last!.json,
        bytes: contextBytes(last!.json),
        estimatedTokens: estimateTokens(last!.json),
        domains,
        focus: route.includeFocus && last!.ctx.focus != null,
        dropped,
      };
    }
    dropped.unshift(domains.pop()!);
  }
}
