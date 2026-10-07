"use client";

import { useCallback, useRef, useState } from "react";
import type { BuiltContext } from "@/lib/ai/context";
import {
  AI_HISTORY_ANSWER_CHARS,
  AI_HISTORY_WINDOW,
  DEFAULT_AI_MODEL,
  type AiChatMessage,
  type AiErrorCode,
  type AiRoute,
  type AiStreamEvent,
  type AiUsage,
} from "@/lib/ai/types";

/** What one request carried (shown under the answer to spot context regressions). */
export interface AiRequestMeta {
  intent: AiRoute["intent"];
  domains: AiRoute["domains"];
  focusLabel: string | null;
  contextBytes: number;
  estimatedContextTokens: number;
  /** Earlier messages sent with the question. */
  historyMessages: number;
  /** Set by the server (start event). */
  personalFacts: number | null;
  dropped: AiRoute["domains"];
}

export interface AiUiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Assistant only. */
  state?: "streaming" | "done" | "incomplete" | "stopped" | "error";
  errorCode?: AiErrorCode;
  usage?: AiUsage | null;
  meta?: AiRequestMeta;
}

export type AiStatus = "ready" | "thinking" | "unavailable";

export interface AiSessionTelemetry {
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/** Route + context for one question, built by the caller from the current AURELIS state. */
export type PrepareAiRequest = (question: string, nowMs: number) => { route: AiRoute; built: BuiltContext };

/** History window: earlier messages (no errors/empty answers), long answers clipped, then the question. */
export function historyWindow(messages: AiUiMessage[], question: string): AiChatMessage[] {
  const earlier = messages
    .filter((m) => m.role === "user" || (m.content.trim() && m.state !== "error"))
    .map((m) => ({
      role: m.role,
      content:
        m.role === "assistant" && m.content.length > AI_HISTORY_ANSWER_CHARS
          ? `${m.content.slice(0, AI_HISTORY_ANSWER_CHARS)}…`
          : m.content,
    }));
  return [...earlier, { role: "user" as const, content: question }].slice(-AI_HISTORY_WINDOW);
}

/**
 * Session-only SMILEY chat: kept by Workspace (survives closing the panel),
 * cleared on reload; never stored. One request at a time; STOP aborts it.
 * Session token telemetry survives NEW (it measures this page session).
 */
export function useAiChat() {
  const [messages, setMessages] = useState<AiUiMessage[]>([]);
  const [status, setStatus] = useState<AiStatus>("ready");
  const [model, setModel] = useState(DEFAULT_AI_MODEL);
  const [session, setSession] = useState<AiSessionTelemetry>({ requests: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 });
  const controllerRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  const patch = useCallback((id: number, change: Partial<AiUiMessage> | ((m: AiUiMessage) => Partial<AiUiMessage>)) => {
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...(typeof change === "function" ? change(m) : change) } : m)));
  }, []);

  const send = useCallback(
    async (text: string, prepare: PrepareAiRequest) => {
      const question = text.trim();
      if (!question || controllerRef.current) return;
      const { route, built } = prepare(question, Date.now());
      const window = historyWindow(messages, question);
      const meta: AiRequestMeta = {
        intent: route.intent,
        domains: built.domains,
        focusLabel: built.focus ? String((built.context?.focus as { label?: string } | null)?.label ?? "") : null,
        contextBytes: built.bytes,
        estimatedContextTokens: built.estimatedTokens,
        historyMessages: window.length - 1,
        personalFacts: null,
        dropped: built.dropped,
      };

      const userId = nextId.current++;
      const answerId = nextId.current++;
      setMessages((list) => [
        ...list,
        { id: userId, role: "user", content: question },
        { id: answerId, role: "assistant", content: "", state: "streaming", meta },
      ]);
      setStatus("thinking");
      setSession((s) => ({ ...s, requests: s.requests + 1 }));
      const controller = new AbortController();
      controllerRef.current = controller;

      let finished = false;
      const finish = (change: Partial<AiUiMessage>, next: AiStatus) => {
        if (finished) return;
        finished = true;
        patch(answerId, change);
        setStatus(next);
      };

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: window,
            context: built.context,
            route: { intent: route.intent, domains: built.domains, focusKind: route.focusKind, includePersonal: route.includePersonal },
          }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || !response.body) {
          let code: AiErrorCode = "upstream";
          try {
            const body = (await response.json()) as { code?: AiErrorCode };
            if (body.code) code = body.code;
          } catch {
            // Fixed message below.
          }
          finish({ state: "error", errorCode: code }, "unavailable");
          return;
        }
        const handle = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as AiStreamEvent;
          if (event.type === "start") {
            setModel(event.model);
            patch(answerId, (m) => ({ meta: m.meta && { ...m.meta, personalFacts: event.personalFacts } }));
          } else if (event.type === "delta") patch(answerId, (m) => ({ content: m.content + event.text }));
          else if (event.type === "done") {
            const u = event.usage;
            if (u)
              setSession((s) => ({
                ...s,
                inputTokens: s.inputTokens + (u.inputTokens ?? 0),
                cachedInputTokens: s.cachedInputTokens + (u.cachedInputTokens ?? 0),
                outputTokens: s.outputTokens + (u.outputTokens ?? 0),
              }));
            finish({ state: event.status === "completed" ? "done" : "incomplete", usage: u }, "ready");
          } else if (event.type === "error")
            finish({ state: event.code === "aborted" ? "stopped" : "error", errorCode: event.code }, event.code === "aborted" ? "ready" : "unavailable");
        };
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            handle(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
          }
        }
        handle(buffer);
        // Ended without done/error: incomplete transport.
        finish({ state: "error", errorCode: "upstream" }, "unavailable");
      } catch {
        if (controller.signal.aborted) finish({ state: "stopped" }, "ready");
        else finish({ state: "error", errorCode: "upstream" }, "unavailable");
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [messages, patch],
  );

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  /** NEW: clears the conversation only (no other AURELIS state; session telemetry stays). */
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setMessages([]);
    setStatus("ready");
  }, []);

  return { messages, status, model, session, busy: status === "thinking", send, stop, reset };
}

export type AiChat = ReturnType<typeof useAiChat>;
