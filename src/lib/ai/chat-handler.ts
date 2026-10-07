import { contextBytes, serializeContext } from "./context";
import { describeError, mapAiError, AI_REQUEST_TIMEOUT_MS, type AurelisAIProvider } from "./openai";
import { formatPersonalFacts, selectPersonalFacts, type PersonalIntelligenceProfile } from "./personal";
import { developerMessage } from "./system-prompt";
import {
  AI_DOMAINS,
  AI_FOCUS_KINDS,
  AI_HISTORY_WINDOW,
  AI_INTENTS,
  AI_MAX_CONTEXT_BYTES,
  AI_MAX_MESSAGE_CHARS,
  estimateTokens,
  type AiChatMessage,
  type AiDomain,
  type AiErrorCode,
  type AiFocusKind,
  type AiIntent,
  type AiStreamEvent,
} from "./types";

/** Raw request body ceiling (messages + context). */
const MAX_BODY_BYTES = 64 * 1024;

/** The route as the browser reports it (validated; it only selects personal facts and labels logs). */
export interface ParsedRoute {
  intent: AiIntent;
  domains: AiDomain[];
  focusKind: AiFocusKind | null;
  includePersonal: boolean;
}

export type ParsedChatRequest = {
  messages: AiChatMessage[];
  /** null = no operational context for this question. */
  context: Record<string, unknown> | null;
  route: ParsedRoute;
};

function parseRoute(value: unknown): ParsedRoute | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!AI_INTENTS.includes(r.intent as AiIntent)) return null;
  if (!Array.isArray(r.domains) || !r.domains.every((d) => AI_DOMAINS.includes(d as AiDomain))) return null;
  const focusKind = r.focusKind === null || r.focusKind === undefined ? null : r.focusKind;
  if (focusKind !== null && !AI_FOCUS_KINDS.includes(focusKind as AiFocusKind)) return null;
  return {
    intent: r.intent as AiIntent,
    domains: [...new Set(r.domains as AiDomain[])],
    focusKind: focusKind as AiFocusKind | null,
    includePersonal: r.includePersonal === true,
  };
}

/**
 * Validates the browser's body: the last AI_HISTORY_WINDOW messages (user /
 * assistant text only, the last one from the user), a bounded context object
 * (or null) and the route. The browser never chooses the model or options.
 */
export function parseChatRequest(body: unknown): ParsedChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const { messages, context, route } = body as { messages?: unknown; context?: unknown; route?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) return null;
  if (context !== null && (!context || typeof context !== "object" || Array.isArray(context))) return null;
  const parsedRoute = parseRoute(route);
  if (!parsedRoute) return null;
  const window: AiChatMessage[] = [];
  for (const m of messages.slice(-AI_HISTORY_WINDOW)) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > AI_MAX_MESSAGE_CHARS) return null;
    window.push({ role, content: text });
  }
  if (window[window.length - 1].role !== "user") return null;
  if (context && contextBytes(JSON.stringify(context)) > AI_MAX_CONTEXT_BYTES) return null;
  return { messages: window, context: (context as Record<string, unknown> | null) ?? null, route: parsedRoute };
}

/** Same-origin browser requests only (blocks other sites from spending tokens through a local server). */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) return false;
    } catch {
      return false;
    }
  }
  return true;
}

const json = (status: number, code: AiErrorCode) =>
  new Response(JSON.stringify({ type: "error", code }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * POST /api/ai/chat: one question → exactly one streaming upstream call.
 * The server adds the route's personal facts (the profile never leaves the
 * server whole) and responds with NDJSON AiStreamEvents. Errors are fixed
 * codes; upstream messages, bodies, headers and the key never reach the
 * browser or the log. The browser aborting the fetch aborts the upstream call.
 */
export async function handleChat(
  request: Request,
  provider: AurelisAIProvider | null,
  profile: PersonalIntelligenceProfile,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, "bad_request");
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json(415, "bad_request");
  if (!provider) return json(503, "not_configured");

  let parsed: ParsedChatRequest | null = null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length <= MAX_BODY_BYTES) parsed = parseChatRequest(JSON.parse(text));
  } catch {
    parsed = null;
  }
  if (!parsed) return json(400, "bad_request");

  const upstream = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    upstream.abort();
  }, timeoutMs);
  const onClientAbort = () => upstream.abort();
  request.signal.addEventListener("abort", onClientAbort);

  const facts = selectPersonalFacts(profile, parsed.route);
  const serializedContext = parsed.context ? serializeContext(parsed.context) : null;
  const developer = developerMessage(formatPersonalFacts(facts), serializedContext);
  const messages = parsed.messages;
  const { route } = parsed;
  // Request shape, for diagnosis (no content, no key).
  const shape =
    `intent=${route.intent} domains=${route.domains.join("+") || "none"} focus=${parsed.context?.focus ? "yes" : "no"} ` +
    `personal=${facts.length} history=${messages.length - 1} context=${((serializedContext?.length ?? 0) / 1024).toFixed(1)} KB ` +
    `(~${estimateTokens(developer ?? "")} est)`;

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AiStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client gone.
        }
      };
      const startedAt = Date.now();
      try {
        for await (const event of provider.stream({ messages, developer }, upstream.signal)) {
          send(event.type === "start" ? { ...event, personalFacts: facts.length } : event);
          if (event.type === "done") {
            const u = event.usage;
            console.info(
              `[SMILEY] ${provider.model} ${event.status} ${Date.now() - startedAt} ms · ${shape} · in=${u?.inputTokens ?? "-"} (cached ${u?.cachedInputTokens ?? "-"}) out=${u?.outputTokens ?? "-"} (reasoning ${u?.reasoningTokens ?? "-"})`,
            );
          }
          if (event.type === "done" || event.type === "error") break;
        }
      } catch (error) {
        const code = timedOut ? "timeout" : mapAiError(error);
        if (code !== "aborted") console.warn(`[SMILEY] request failed: ${code} · ${describeError(error)} · ${shape}`);
        send({ type: "error", code });
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", onClientAbort);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      upstream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
