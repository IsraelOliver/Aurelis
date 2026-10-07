"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AI_ERROR_TEXT, AI_MAX_MESSAGE_CHARS, modelLabel, type AiDomain } from "@/lib/ai/types";
import type { AiChat, AiUiMessage, PrepareAiRequest } from "@/components/useAiChat";
import AiMarkdown from "./AiMarkdown";

const DOMAINS: { id: AiDomain; label: string }[] = [
  { id: "space", label: "SPACE" },
  { id: "disasters", label: "DISASTERS" },
  { id: "weather", label: "WEATHER" },
  { id: "air", label: "AIR" },
];

const SUGGESTIONS = [
  "WHAT DESERVES MY ATTENTION NOW?",
  "SUMMARIZE THE CURRENT AURELIS STATE",
  "EXPLAIN CURRENT SPACE WEATHER",
  "ARE THERE ANY SIGNIFICANT RECENT DISASTERS?",
];

const n0 = new Intl.NumberFormat("en-US");
/** 842 → "842", 5665 → "5.7K". */
const kTokens = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}K`);

/** Small abstract mark: orbit, nodes and a reticle (inline SVG, AURELIS palette). */
function SmileyMark({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="22" className="stroke-line-strong" strokeWidth="1" />
      <ellipse cx="32" cy="32" rx="28" ry="10" transform="rotate(-24 32 32)" className="stroke-cyan/60" strokeWidth="1" />
      <path d="M32 4v8M32 52v8M4 32h8M52 32h8" className="stroke-fg-subtle" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 24l8 8-8 8-8-8z" className="stroke-gold" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="1.6" className="fill-gold" />
      <circle cx="55.6" cy="21.6" r="1.8" className="fill-cyan" />
      <circle cx="8.4" cy="42.4" r="1.2" className="fill-cyan/70" />
    </svg>
  );
}

function StatusDot({ status }: { status: AiChat["status"] }) {
  if (status === "thinking") return <span className="size-1.5 animate-pulse rounded-full bg-gold" aria-hidden="true" />;
  if (status === "unavailable") return <span className="size-1.5 rounded-full border border-fg-subtle" aria-hidden="true" />;
  return <span className="size-1.5 rounded-full bg-cyan" aria-hidden="true" />;
}

function Chip({ active = true, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-sm border px-1.5 text-[9px] font-medium tracking-[0.16em] ${
        active ? "border-cyan/40 text-cyan" : "border-line text-fg-subtle/60"
      }`}
    >
      {children}
    </span>
  );
}

/** CONTEXT + TOKENS under an answer: enough to spot a context regression at a glance. */
function RequestMetrics({ message }: { message: AiUiMessage }) {
  const meta = message.meta;
  if (!meta) return null;
  const u = message.usage;
  const parts = [...meta.domains.map((d) => d.toUpperCase()), ...(meta.focusLabel ? ["FOCUS"] : [])];
  const details = [
    `intent ${meta.intent}`,
    `personal facts ${meta.personalFacts ?? "—"}`,
    `context ${(meta.contextBytes / 1024).toFixed(1)} KB (~${meta.estimatedContextTokens} tokens est.)`,
    `history ${meta.historyMessages} messages`,
    ...(meta.dropped.length ? [`omitted for budget: ${meta.dropped.join(", ")}`] : []),
    ...(u ? [`input ${u.inputTokens ?? "—"} (cached ${u.cachedInputTokens ?? "—"}) · output ${u.outputTokens ?? "—"} (reasoning ${u.reasoningTokens ?? "—"})`] : []),
  ].join("\n");
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9.5px] text-fg-subtle/90" title={details}>
      <span>
        <span className="mr-1.5 font-sans text-[9px] font-medium tracking-[0.2em]">CONTEXT</span>
        <span className={parts.length ? "text-cyan/80" : ""}>{parts.length ? parts.join(" · ") : "NONE"}</span>
      </span>
      {meta.focusLabel && <span className="max-w-[11rem] truncate text-gold/80">{meta.focusLabel}</span>}
      {u && (
        <span className="ml-auto">
          {u.inputTokens !== null ? n0.format(u.inputTokens) : "—"} IN · {u.outputTokens !== null ? n0.format(u.outputTokens) : "—"} OUT
        </span>
      )}
    </div>
  );
}

function Message({ message }: { message: AiUiMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-10 rounded border border-gold/35 bg-elevated px-3 py-2.5">
        <p className="mb-1 text-[9.5px] font-medium tracking-[0.24em] text-gold/80">YOU</p>
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg">{message.content}</p>
      </div>
    );
  }
  return (
    <div className="relative pl-3" aria-live={message.state === "streaming" ? "polite" : undefined}>
      <span className="absolute inset-y-0.5 left-0 w-px bg-cyan/50" aria-hidden="true" />
      <p className="mb-1.5 flex items-center gap-2 text-[9.5px] font-medium tracking-[0.24em] text-fg-subtle">
        <span className="size-1.5 rounded-full bg-cyan" aria-hidden="true" />
        SMILEY
      </p>
      {message.content ? (
        <AiMarkdown text={message.content} />
      ) : message.state === "streaming" ? (
        <p className="animate-pulse text-[10.5px] tracking-[0.2em] text-fg-subtle">THINKING…</p>
      ) : null}
      {message.state === "stopped" && <p className="mt-2 text-[9.5px] tracking-[0.22em] text-fg-subtle">STOPPED</p>}
      {message.state === "incomplete" && (
        <p className="mt-2 text-[9.5px] tracking-[0.22em] text-fg-subtle">INCOMPLETE · answer length limit reached</p>
      )}
      {message.state === "error" && (
        <p role="status" className="mt-2 rounded border border-line px-2.5 py-1.5 text-[10.5px] tracking-[0.06em] text-fg-muted">
          {AI_ERROR_TEXT[message.errorCode ?? "upstream"]}
        </p>
      )}
      {message.state !== "streaming" && message.state !== "error" && <RequestMetrics message={message} />}
    </div>
  );
}

/**
 * SMILEY panel — the user's personal intelligence over AURELIS (read-only).
 * Occupies the right panel; the conversation lives in Workspace (useAiChat),
 * so closing and reopening keeps it, and a reload clears it. Opening the panel
 * makes no request.
 */
export default function AiPanel({
  chat,
  domains,
  focusLabel,
  prepare,
  onClose,
}: {
  chat: AiChat;
  /** Domains with loaded data. */
  domains: AiDomain[];
  /** Selected entity, if any. */
  focusLabel: string | null;
  /** Routes the question and builds its context at send time (current state). */
  prepare: PrepareAiRequest;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const { messages, status, busy, session } = chat;
  const canSend = draft.trim().length > 0 && !busy;
  const sessionTokens = session.inputTokens + session.outputTokens;

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    stickToBottom.current = true;
    void chat.send(text, prepare);
    setDraft("");
  };

  // Auto-grow the composer (up to ~7 lines).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, [draft]);

  // Follow the stream unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <aside aria-label="SMILEY" className="flex w-[420px] max-w-[50vw] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-fg">
            <span className="text-gold" aria-hidden="true">◇</span>
            SMILEY
          </p>
          <p className="mt-1 text-[9.5px] font-medium tracking-[0.28em] text-fg-subtle">AURELIS PERSONAL INTELLIGENCE</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted">
            <span className="flex items-center gap-2" role="status">
              <StatusDot status={status} />
              {status.toUpperCase()}
            </span>
            <span className="text-fg-subtle">·</span>
            <span className="font-mono tracking-[0.08em] text-fg-subtle">{modelLabel(chat.model)}</span>
            {session.requests > 0 && (
              <>
                <span className="text-fg-subtle">·</span>
                <span
                  className="font-mono tracking-[0.08em] text-fg-subtle"
                  title={`This session: ${session.requests} request(s) · ${n0.format(session.inputTokens)} input (${n0.format(session.cachedInputTokens)} cached) · ${n0.format(session.outputTokens)} output tokens`}
                >
                  SESSION {kTokens(sessionTokens)} TOKENS
                </span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            chat.reset();
            setDraft("");
            inputRef.current?.focus();
          }}
          disabled={messages.length === 0}
          title="New conversation (clears this chat only)"
          className="h-7 shrink-0 rounded border border-line-strong px-2.5 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-gold/60 hover:text-gold disabled:pointer-events-none disabled:opacity-40"
        >
          NEW
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close SMILEY"
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center gap-6 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <SmileyMark />
              <p className="text-[11px] font-semibold tracking-[0.32em] text-fg">SMILEY</p>
              <p className="max-w-[17rem] text-[12px] leading-relaxed text-fg-muted">
                Personal intelligence for your AURELIS dashboard.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="group flex items-center gap-2 rounded border border-deep bg-base/40 px-3 py-2.5 text-left text-[10px] font-medium tracking-[0.18em] text-fg-muted transition-colors hover:border-gold/50 hover:text-fg"
                >
                  <span className="text-cyan/70 transition-colors group-hover:text-gold" aria-hidden="true">›</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 pb-3 pt-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1" title="Domains with data loaded in AURELIS (sent only when a question needs them)">
          <span className="mr-1 text-[9px] font-medium tracking-[0.22em] text-fg-subtle">AVAILABLE</span>
          {DOMAINS.map((d) => (
            <Chip key={d.id} active={domains.includes(d.id)}>
              {d.label}
            </Chip>
          ))}
        </div>
        {focusLabel && (
          <div className="mb-2 flex items-center gap-2 rounded-sm border-l-2 border-gold bg-elevated px-2.5 py-1.5">
            <span className="text-[9px] font-medium tracking-[0.22em] text-fg-subtle">FOCUS</span>
            <span className="min-w-0 truncate text-[10.5px] font-medium tracking-[0.12em] text-gold">{focusLabel}</span>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="flex items-end gap-2 rounded border border-line-strong bg-base px-2.5 py-2 focus-within:border-cyan/50"
        >
          <label htmlFor="smiley-input" className="sr-only">
            Ask Smiley
          </label>
          <textarea
            id="smiley-input"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={AI_MAX_MESSAGE_CHARS}
            placeholder="ASK SMILEY..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(draft);
              }
            }}
            className="min-h-6 flex-1 resize-none bg-transparent py-0.5 text-[12.5px] leading-relaxed text-fg outline-none placeholder:text-[10.5px] placeholder:tracking-[0.2em] placeholder:text-fg-subtle"
          />
          {busy ? (
            <button
              type="button"
              onClick={chat.stop}
              aria-label="Stop the answer"
              title="Stop"
              className="flex h-7 shrink-0 items-center gap-1.5 rounded border border-line-strong px-2 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              <span className="size-2 rounded-[1px] bg-current" aria-hidden="true" />
              STOP
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className={`grid size-7 shrink-0 place-items-center rounded transition-colors ${
                canSend ? "text-gold hover:bg-elevated" : "text-fg-subtle/50"
              }`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </form>
        <p className="mt-1.5 text-[9.5px] leading-snug text-fg-subtle/80">
          Read-only. Interprets AURELIS data; it is not a source.
        </p>
      </div>
    </aside>
  );
}
