import "server-only";
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";
import type { ResponseInputItem, ResponseUsage } from "openai/resources/responses/responses";
import { SMILEY_INSTRUCTIONS } from "./system-prompt";
import { DEFAULT_AI_MODEL, type AiChatMessage, type AiErrorCode, type AiStreamEvent, type AiUsage } from "./types";

/** Output budget per answer (reasoning tokens included). */
export const AI_MAX_OUTPUT_TOKENS = 2_000;
/** Whole-request ceiling, streaming included (the route enforces it). */
export const AI_REQUEST_TIMEOUT_MS = 90_000;

export interface AiProviderRequest {
  /** Session window, oldest first; the last one is the user's question. */
  messages: AiChatMessage[];
  /** Personal facts + AURELIS context for this route (null = none needed). */
  developer: string | null;
}

/** Minimal provider boundary: one streaming call per question. */
export interface AurelisAIProvider {
  readonly model: string;
  stream(request: AiProviderRequest, signal: AbortSignal): AsyncGenerator<AiStreamEvent>;
}

/** Model chosen on the server only (AURELIS_AI_MODEL, else gpt-6-luna); never by the browser. */
export const aiModel = () => process.env.AURELIS_AI_MODEL?.trim() || DEFAULT_AI_MODEL;

/**
 * Stable first, dynamic last (prompt-cache friendly): instructions (separate
 * field) → history → developer message (only when needed) → question.
 */
export function buildResponsesInput({ messages, developer }: AiProviderRequest): ResponseInputItem[] {
  const history = messages.slice(0, -1);
  const question = messages[messages.length - 1];
  return [
    ...history.map((m) => ({ role: m.role, content: m.content }) as ResponseInputItem),
    ...(developer ? [{ role: "developer", content: developer } as ResponseInputItem] : []),
    { role: "user", content: question.content },
  ];
}

/** Error → fixed category. Upstream messages are never kept (they can echo request data). */
export function mapAiError(error: unknown): AiErrorCode {
  if (error instanceof APIUserAbortError) return "aborted";
  if (error instanceof APIConnectionTimeoutError) return "timeout";
  if (error instanceof APIConnectionError) return "upstream";
  if (error instanceof APIError) {
    const status = error.status ?? 0;
    if (status === 401 || status === 403) return "auth";
    if (status === 429) return error.code === "insufficient_quota" ? "quota" : "rate_limited";
    if (status === 400 || status === 404 || status === 422) return "bad_request";
    return "upstream";
  }
  if (error instanceof Error && error.name === "AbortError") return "aborted";
  return "upstream";
}

/** Codes of in-stream `error` events / failed responses. */
export function mapStreamErrorCode(code: string | null | undefined): AiErrorCode {
  if (code === "insufficient_quota") return "quota";
  if (code === "rate_limit_exceeded") return "rate_limited";
  return "upstream";
}

export function toAiUsage(usage: ResponseUsage | null | undefined): AiUsage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? null,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? null,
  };
}

/** Log line without message, body, headers or key: class, status, code, request id. */
export function describeError(error: unknown): string {
  if (error instanceof APIError) return `${error.constructor.name} status=${error.status ?? "-"} code=${error.code ?? "-"} request=${error.requestID ?? "-"}`;
  return error instanceof Error ? error.name : "unknown";
}

type ResponsesClient = Pick<OpenAI, "responses">;

/** OpenAI Responses API, streaming, store: false, no tools, low reasoning effort. */
export class OpenAIAurelisProvider implements AurelisAIProvider {
  readonly model: string;
  private readonly client: ResponsesClient;

  constructor(client: ResponsesClient, model: string) {
    this.client = client;
    this.model = model;
  }

  async *stream(request: AiProviderRequest, signal: AbortSignal): AsyncGenerator<AiStreamEvent> {
    const stream = await this.client.responses.create(
      {
        model: this.model,
        instructions: SMILEY_INSTRUCTIONS,
        input: buildResponsesInput(request),
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: AI_MAX_OUTPUT_TOKENS,
      },
      { signal },
    );
    yield { type: "start", model: this.model, personalFacts: 0 };
    for await (const event of stream) {
      switch (event.type) {
        case "response.output_text.delta":
          if (event.delta) yield { type: "delta", text: event.delta };
          break;
        case "response.completed":
          yield { type: "done", status: "completed", incompleteReason: null, usage: toAiUsage(event.response.usage) };
          return;
        case "response.incomplete":
          yield {
            type: "done",
            status: "incomplete",
            incompleteReason: event.response.incomplete_details?.reason ?? null,
            usage: toAiUsage(event.response.usage),
          };
          return;
        case "response.failed":
          console.warn(`[SMILEY] response failed: code=${event.response.error?.code ?? "-"}`);
          yield { type: "error", code: mapStreamErrorCode(event.response.error?.code) };
          return;
        case "error":
          console.warn(`[SMILEY] stream error: code=${event.code ?? "-"}`);
          yield { type: "error", code: mapStreamErrorCode(event.code) };
          return;
        // Reasoning, refusals and every other event are not forwarded (no chain-of-thought).
      }
    }
    // Stream ended without a terminal event.
    yield { type: "error", code: "upstream" };
  }
}

let cached: { key: string; model: string; provider: OpenAIAurelisProvider } | null = null;

/** Server-side singleton; null when OPENAI_API_KEY is not configured. */
export function getAurelisAIProvider(): AurelisAIProvider | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const model = aiModel();
  if (!cached || cached.key !== key || cached.model !== model) {
    // No automatic retries (no silent token spend); the route bounds the whole request.
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: AI_REQUEST_TIMEOUT_MS });
    cached = { key, model, provider: new OpenAIAurelisProvider(client, model) };
  }
  return cached.provider;
}
