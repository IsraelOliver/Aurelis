import "server-only";
import type { PersonalFact, PersonalIntelligenceProfile } from "./personal";

/**
 * The user's Personal Intelligence Profile (stage AI 1B): user-stated
 * interests, information style, attention policy and current creative
 * context. Server-only (never in the browser bundle) and never sent whole:
 * selectPersonalFacts picks a few facts per request.
 * Deliberately excludes names, family, address, work details and biography.
 * Future: SQLite storage, observed/inferred facts (kept separate, never
 * auto-promoted to user_stated).
 */

const interest = (key: string, value: string, level: PersonalFact["level"], topics: PersonalFact["topics"]): PersonalFact => ({
  key: `interest.${key}`,
  kind: "interest",
  value,
  level,
  topics,
  origin: "user_stated",
  confidence: "high",
});

const style = (key: string, value: string, use: PersonalFact["use"]): PersonalFact => ({
  key: `style.${key}`,
  kind: "information_style",
  value,
  use,
  origin: "user_stated",
  confidence: "high",
});

const fact = (kind: PersonalFact["kind"], key: string, value: string): PersonalFact => ({
  key: `${kind}.${key}`,
  kind,
  value,
  origin: "user_stated",
  confidence: "high",
});

export const PERSONAL_PROFILE: PersonalIntelligenceProfile = {
  version: 1,
  facts: [
    interest("astronomy", "astronomy", "very_high", ["astronomy"]),
    interest("space_exploration", "space exploration", "very_high", ["space_exploration"]),
    interest("geology", "geology", "high", ["geology"]),
    interest("deep_time", "deep time", "high", ["deep_time", "geology"]),
    interest("technology", "technology", "high", ["technology"]),
    interest("ancient_civilizations", "ancient civilizations", "high", ["ancient_civilizations"]),
    interest("science_communication", "science communication", "high", ["science_communication"]),
    interest("worldbuilding", "worldbuilding", "high", ["worldbuilding"]),
    interest("marine_biology", "marine biology", "medium_high", ["marine_biology"]),
    interest("aviation", "aviation", "medium_high", ["aviation"]),
    interest("global_events", "globally significant events", "medium_high", ["global_events"]),

    style("technical", "likes technical explanations", ["explain", "general"]),
    style("primary_sources", "prefers primary sources", ["explain"]),
    style("depth", "prefers depth over volume: a few good items, not a feed", ["general", "prioritize"]),
    style("causal", "values causal explanations", ["explain"]),
    style("geographic", "values geographic/visual context", ["explain"]),
    style("signal", "prefers signal over trends; dislikes shallow or clickbait information", ["prioritize"]),
    style("challenge", "wants assumptions challenged", ["general"]),

    fact("attention_policy", "unusual", "unusual > routine; a major development > an incremental update; rarity and scientific novelty matter"),
    fact("attention_policy", "not_urgent", "not every interesting item is urgent: distinguish curiosity from priority"),

    fact("creative_context", "eon", "Eon (personal project)"),
    fact("creative_context", "aurelis", "AURELIS (this dashboard)"),
    fact("creative_context", "nyvorn", "Nyvorn (paused)"),
    fact("creative_context", "science_communication", "science communication"),
    fact("creative_context", "pixel_art", "pixel art"),
    fact("creative_context", "software_games", "software and game development"),
  ],
};
