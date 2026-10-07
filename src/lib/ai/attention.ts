import { INTEREST_WEIGHT, type PersonalFact, type ProfileTopic } from "./personal";

/**
 * Attention Engine — FOUNDATION ONLY (stage AI 1B). Deterministic scoring of
 * "how much does this deserve the user's attention", without any LLM call,
 * not wired to any feed yet and never shown as a number in the UI.
 *
 * The six personal capabilities it prepares:
 * 1. Personal relevance      → interestMatch()
 * 2. Why you may care        → AttentionScore.reasons
 * 3. Depth over volume       → selectForAttention(): few items above a floor
 * 4. Controlled serendipity  → serendipitySlots (0 = off)
 * 5. Anti-distraction        → category: interesting ≠ relevant ≠ actionable ≠ urgent;
 *                              interest alone never makes something urgent
 * 6. Creative connections    → CREATIVE_CONNECTIONS (disabled, high threshold)
 */

export type SignificanceLevel = "routine" | "notable" | "significant" | "major";
export type ActionabilityLevel = "none" | "awareness" | "actionable" | "urgent";
/** Anti-distraction ladder. "interesting" = curiosity, not an obligation. */
export type AttentionCategory = "routine" | "interesting" | "relevant" | "actionable" | "urgent";

export const SIGNIFICANCE_VALUE: Record<SignificanceLevel, number> = { routine: 0.1, notable: 0.4, significant: 0.7, major: 1 };
export const ACTIONABILITY_VALUE: Record<ActionabilityLevel, number> = { none: 0, awareness: 0.3, actionable: 0.6, urgent: 1 };

/** Inputs, each 0..1, produced by domain adapters (not by the LLM). */
export interface AttentionSignals {
  topics: ProfileTopic[];
  significance: number;
  rarity: number;
  recency: number;
  novelty: number;
  actionability: number;
}

export interface AttentionScore {
  interest: number;
  significance: number;
  rarity: number;
  recency: number;
  novelty: number;
  actionability: number;
  /** Weighted priority 0..1 (internal; no false precision in the UI). */
  priority: number;
  category: AttentionCategory;
  /** "Why you may care", in plain words. */
  reasons: string[];
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Recency 1 → 0 with a half-life (e.g. 6 h for quakes, 3 days for EONET). */
export const recencyFromAge = (ageMs: number, halfLifeMs: number) => clamp01(0.5 ** (Math.max(0, ageMs) / halfLifeMs));

/** Best interest weight among the item's topics, and which interest matched. */
export function interestMatch(topics: ProfileTopic[], facts: PersonalFact[]): { score: number; matched: PersonalFact | null } {
  let best: PersonalFact | null = null;
  for (const f of facts) {
    if (f.kind !== "interest" || !f.topics?.some((t) => topics.includes(t))) continue;
    if (!best || INTEREST_WEIGHT[f.level ?? "low"] > INTEREST_WEIGHT[best.level ?? "low"]) best = f;
  }
  return { score: best ? INTEREST_WEIGHT[best.level ?? "low"] : 0, matched: best };
}

/**
 * Significance and rarity weigh more than interest: an interesting routine item
 * stays "interesting", it does not become "relevant" or "urgent".
 */
export function scoreAttention(signals: AttentionSignals, facts: PersonalFact[]): AttentionScore {
  const { score: interest, matched } = interestMatch(signals.topics, facts);
  const s = {
    significance: clamp01(signals.significance),
    rarity: clamp01(signals.rarity),
    recency: clamp01(signals.recency),
    novelty: clamp01(signals.novelty),
    actionability: clamp01(signals.actionability),
  };
  const priority = clamp01(0.35 * s.significance + 0.2 * s.rarity + 0.15 * s.novelty + 0.1 * s.recency + 0.2 * interest);
  const category: AttentionCategory =
    s.actionability >= 0.85
      ? "urgent"
      : s.actionability >= 0.5
        ? "actionable"
        : s.significance >= 0.6 || priority >= 0.6
          ? "relevant"
          : interest >= 0.6
            ? "interesting"
            : "routine";
  const reasons: string[] = [];
  if (s.significance >= 0.6) reasons.push("significant");
  if (s.rarity >= 0.6) reasons.push("rare");
  if (s.novelty >= 0.6) reasons.push("new or scientifically novel");
  if (s.recency >= 0.7) reasons.push("recent");
  if (matched) reasons.push(`matches your interest in ${matched.value}`);
  return { interest, ...s, priority, category, reasons };
}

/**
 * Depth over volume: at most `max` items above `minPriority`, best first.
 * Serendipity: up to `serendipitySlots` significant/novel items outside the
 * user's interests (off by default).
 */
export function selectForAttention<T>(
  items: { item: T; score: AttentionScore }[],
  { max = 3, minPriority = 0.45, serendipitySlots = 0 }: { max?: number; minPriority?: number; serendipitySlots?: number } = {},
): { item: T; score: AttentionScore; serendipity?: true }[] {
  const ranked = [...items].sort((a, b) => b.score.priority - a.score.priority);
  const chosen: { item: T; score: AttentionScore; serendipity?: true }[] = ranked
    .filter((x) => x.score.priority >= minPriority)
    .slice(0, max);
  if (serendipitySlots > 0) {
    const outside = ranked.filter(
      (x) => !chosen.includes(x) && x.score.interest < 0.5 && Math.max(x.score.significance, x.score.novelty) >= 0.7,
    );
    chosen.push(...outside.slice(0, serendipitySlots).map((x) => ({ ...x, serendipity: true as const })));
  }
  return chosen;
}

/** Example adapter (not wired yet): an earthquake's signals from its own data. */
export function earthquakeSignals(magnitude: number | null, ageMs: number, tsunamiFlag: boolean): AttentionSignals {
  const m = magnitude ?? 0;
  return {
    topics: ["geology"],
    significance: m >= 7 ? 1 : m >= 6 ? 0.75 : m >= 5 ? 0.4 : 0.1,
    rarity: m >= 7 ? 1 : m >= 6 ? 0.7 : m >= 5 ? 0.3 : 0.05,
    recency: recencyFromAge(ageMs, 6 * 3_600_000),
    novelty: 0,
    // A tsunami flag is a reason to check official warnings, not an alert from AURELIS.
    actionability: tsunamiFlag ? 0.3 : 0,
  };
}

/** Creative connections (to Eon, Nyvorn, science communication…): prepared, not active. */
export const CREATIVE_CONNECTIONS = { enabled: false, threshold: 0.9 } as const;

export const PERSONAL_CAPABILITIES = [
  { id: "personal_relevance", status: "foundation", via: "interestMatch" },
  { id: "why_you_may_care", status: "foundation", via: "AttentionScore.reasons" },
  { id: "depth_over_volume", status: "foundation", via: "selectForAttention(max, minPriority)" },
  { id: "controlled_serendipity", status: "prepared (off)", via: "serendipitySlots" },
  { id: "anti_distraction", status: "foundation", via: "AttentionCategory" },
  { id: "creative_connections", status: "prepared (off)", via: "CREATIVE_CONNECTIONS" },
] as const;
