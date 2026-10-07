import type { SourceHealth } from "@/types";

/**
 * SMILEY — the user's personal intelligence inside AURELIS (AURELIS = the
 * platform). Read-only: it interprets AURELIS data and is never a source;
 * nothing it says becomes an Entity or an Observation.
 */

export type AiRole = "user" | "assistant";

export interface AiChatMessage {
  role: AiRole;
  content: string;
}

/** Messages sent per request: the last 4 complete turns (including the new question). */
export const AI_HISTORY_WINDOW = 8;
/** Older answers are clipped in the history window (the full text stays on screen). */
export const AI_HISTORY_ANSWER_CHARS = 1_200;
/** Longest accepted message, characters. */
export const AI_MAX_MESSAGE_CHARS = 4_000;
/** Largest accepted serialized context, bytes (budgets keep it far below). */
export const AI_MAX_CONTEXT_BYTES = 32 * 1024;

export const DEFAULT_AI_MODEL = "gpt-6-luna";

/** "gpt-6-luna" → "GPT-6 LUNA" (display only). */
export const modelLabel = (model: string) => model.toUpperCase().replace(/-(?=[A-Z])/g, " ");

export type AiDomain = "space" | "disasters" | "weather" | "air";
export const AI_DOMAINS: readonly AiDomain[] = ["space", "disasters", "weather", "air"];

/** What a question needs, decided locally (no LLM call) before the request. */
export type AiIntent =
  | "greeting"
  | "general"
  | "focus"
  | "space"
  | "disasters"
  | "weather"
  | "air"
  | "global_situational"
  | "personal"
  | "unknown";

export const AI_INTENTS: readonly AiIntent[] = [
  "greeting",
  "general",
  "focus",
  "space",
  "disasters",
  "weather",
  "air",
  "global_situational",
  "personal",
  "unknown",
];

export type AiFocusKind = "iss" | "earthquake" | "eonet_event" | "aircraft";
export const AI_FOCUS_KINDS: readonly AiFocusKind[] = ["iss", "earthquake", "eonet_event", "aircraft"];

/**
 * Context budget per intent, in estimated tokens of the AURELIS context
 * (system prompt and history excluded). The builder shrinks lists, then drops
 * low-priority capsules, until the estimate fits.
 */
export const CONTEXT_BUDGET_TOKENS: Record<AiIntent, number> = {
  greeting: 300,
  general: 500,
  unknown: 500,
  focus: 800,
  space: 1_200,
  disasters: 1_200,
  weather: 1_200,
  air: 1_200,
  global_situational: 2_500,
  personal: 2_000,
};

/** Router output: what the context builder and the server may include. */
export interface AiRoute {
  intent: AiIntent;
  /** Domain capsules to build (empty = no operational data). */
  domains: AiDomain[];
  /** Selected entity capsule (only when the question is about it, or its domain). */
  includeFocus: boolean;
  /** Kind of the selected entity, when included (picks personal facts). */
  focusKind: AiFocusKind | null;
  /** Personal facts are selected on the server from this route. */
  includePersonal: boolean;
  /** Source health of the included domains. */
  includeSourceHealth: boolean;
  budgetTokens: number;
}

/** Conservative estimate for compact JSON (~3.2 characters per token). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.2);

export interface AiSourceState {
  id: string;
  name: string;
  health: SourceHealth;
  snapshotAgeMs: number | null;
}

/** Sanitized failure categories (never upstream messages, bodies or headers). */
export type AiErrorCode =
  | "not_configured"
  | "bad_request"
  | "auth"
  | "rate_limited"
  | "quota"
  | "timeout"
  | "upstream"
  | "aborted";

export interface AiUsage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
}

/** NDJSON events of /api/ai/chat (one JSON object per line). */
export type AiStreamEvent =
  | { type: "start"; model: string; personalFacts: number }
  | { type: "delta"; text: string }
  | { type: "done"; status: "completed" | "incomplete"; incompleteReason: string | null; usage: AiUsage | null }
  | { type: "error"; code: AiErrorCode };

export const AI_ERROR_TEXT: Record<AiErrorCode, string> = {
  not_configured: "AI SERVICE UNAVAILABLE · not configured on the server.",
  bad_request: "AI SERVICE UNAVAILABLE · the request was rejected.",
  auth: "AI SERVICE UNAVAILABLE · authentication failed.",
  rate_limited: "AI SERVICE UNAVAILABLE · rate limited, try again shortly.",
  quota: "AI SERVICE UNAVAILABLE · usage quota exceeded.",
  timeout: "AI SERVICE UNAVAILABLE · the response timed out.",
  upstream: "AI SERVICE UNAVAILABLE · try again later.",
  aborted: "STOPPED",
};
