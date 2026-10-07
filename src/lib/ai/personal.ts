import type { ConfidenceLevel } from "@/types";
import type { AiDomain, AiFocusKind, AiRoute } from "./types";

/**
 * Personal Intelligence Profile: structured, local, separate from the system
 * prompt. Built for PERSONALIZING ATTENTION, not for re-sending a biography:
 * each request gets only the few facts its route needs (selectPersonalFacts).
 * Shaped so it can later live in SQLite without changing its consumers.
 */

export type ProfileTopic =
  | "astronomy"
  | "space_exploration"
  | "geology"
  | "deep_time"
  | "technology"
  | "ancient_civilizations"
  | "marine_biology"
  | "aviation"
  | "global_events"
  | "science_communication"
  | "worldbuilding";

export type InterestLevel = "very_high" | "high" | "medium_high" | "medium" | "low";

/**
 * Where a fact came from. An inference never silently becomes a stated fact:
 * promoting "inferred" → "user_stated" requires the user saying so.
 */
export type FactOrigin = "user_stated" | "observed" | "inferred";

export type FactKind = "interest" | "information_style" | "attention_policy" | "creative_context";

/** How a style fact is used: explaining something, prioritizing, or any answer. */
export type StyleUse = "explain" | "prioritize" | "general";

export interface PersonalFact {
  key: string;
  kind: FactKind;
  /** Short, model-facing statement. */
  value: string;
  origin: FactOrigin;
  confidence: ConfidenceLevel;
  /** Interests only. */
  level?: InterestLevel;
  /** Topics the fact is about (interest matching). */
  topics?: ProfileTopic[];
  /** Information-style facts only. */
  use?: StyleUse[];
}

export interface PersonalIntelligenceProfile {
  version: 1;
  facts: PersonalFact[];
}

export const INTEREST_WEIGHT: Record<InterestLevel, number> = {
  very_high: 1,
  high: 0.8,
  medium_high: 0.65,
  medium: 0.5,
  low: 0.2,
};

export const DOMAIN_TOPICS: Record<AiDomain, ProfileTopic[]> = {
  space: ["astronomy", "space_exploration"],
  disasters: ["geology", "global_events"],
  weather: [],
  air: ["aviation"],
};

export const FOCUS_TOPICS: Record<AiFocusKind, ProfileTopic[]> = {
  iss: ["space_exploration", "astronomy"],
  earthquake: ["geology", "deep_time"],
  eonet_event: ["global_events", "geology"],
  aircraft: ["aviation"],
};

/** Upper bound of facts per request outside the explicit "personal" intent. */
export const MAX_PERSONAL_FACTS = 6;

const byInterest = (a: PersonalFact, b: PersonalFact) =>
  INTEREST_WEIGHT[b.level ?? "low"] - INTEREST_WEIGHT[a.level ?? "low"];

function interestsFor(profile: PersonalIntelligenceProfile, topics: ProfileTopic[], max: number): PersonalFact[] {
  if (topics.length === 0 || max <= 0) return [];
  return profile.facts
    .filter((f) => f.kind === "interest" && f.topics?.some((t) => topics.includes(t)))
    .sort(byInterest)
    .slice(0, max);
}

const styles = (profile: PersonalIntelligenceProfile, use: StyleUse, max: number) =>
  profile.facts.filter((f) => f.kind === "information_style" && f.use?.includes(use)).slice(0, max);

/**
 * Selective personal context: the few facts relevant to this route.
 * - greeting / unknown: none.
 * - general: how to answer (2 style facts).
 * - domain / focus: matching interests (≤ 3) + how to explain.
 * - global situational: attention policy + top interests of the included domains + 1 prioritizing style.
 * - personal (the user asks about their profile): the whole profile (it holds no private data).
 * Creative context is sent only for "personal" (creative connections are not active).
 */
export function selectPersonalFacts(profile: PersonalIntelligenceProfile, route: Pick<AiRoute, "intent" | "domains" | "focusKind" | "includePersonal">): PersonalFact[] {
  if (!route.includePersonal) return [];
  switch (route.intent) {
    case "greeting":
    case "unknown":
      return [];
    case "personal":
      return profile.facts;
    case "general":
      return styles(profile, "general", 2);
    case "global_situational": {
      const policy = profile.facts.filter((f) => f.kind === "attention_policy").slice(0, 2);
      const topics = route.domains.flatMap((d) => DOMAIN_TOPICS[d]);
      return [...policy, ...interestsFor(profile, topics, 3), ...styles(profile, "prioritize", 1)].slice(0, MAX_PERSONAL_FACTS);
    }
    default: {
      const topics = [
        ...(route.focusKind ? FOCUS_TOPICS[route.focusKind] : []),
        ...route.domains.flatMap((d) => DOMAIN_TOPICS[d]),
      ];
      const interests = interestsFor(profile, [...new Set(topics)], 3);
      return [...interests, ...styles(profile, "explain", Math.max(2, 5 - interests.length))].slice(0, MAX_PERSONAL_FACTS - 1);
    }
  }
}

const LEVEL_TEXT: Record<InterestLevel, string> = {
  very_high: "very high",
  high: "high",
  medium_high: "medium-high",
  medium: "medium",
  low: "low",
};

/** One line per fact; the origin is shown only when it is not user-stated. */
export function formatPersonalFacts(facts: PersonalFact[]): string[] {
  return facts.map((f) => {
    const origin = f.origin === "user_stated" ? "" : ` [${f.origin}, ${f.confidence} confidence]`;
    if (f.kind === "interest") return `- interest: ${f.value} (${LEVEL_TEXT[f.level ?? "medium"]})${origin}`;
    const label = f.kind === "information_style" ? "style" : f.kind === "attention_policy" ? "attention" : "creative";
    return `- ${label}: ${f.value}${origin}`;
  });
}
