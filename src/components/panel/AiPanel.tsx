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
      <ellipse cx="32" cy="32" rx="28" ry="10" transform="rotate(-24 32 32)" className="stroke-data/60" strokeWidth="1" />
      <path d="M32 4v8M32 52v8M4 32h8M52 32h8" className="stroke-fg-subtle" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 24l8 8-8 8-8-8z" className="stroke-accent" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="1.6" className="fill-accent" />
      <circle cx="55.6" cy="21.6" r="1.8" className="fill-data" />
      <circle cx="8.4" cy="42.4" r="1.2" className="fill-data/70" />
    </svg>
  );
}

function StatusDot({ status }: { status: AiChat["status"] }) {
  if (status === "thinking") return <span className="size-1.5 animate-pulse rounded-full bg-accent lg:bg-glint" aria-hidden="true" />;
  if (status === "unavailable") return <span className="size-1.5 rounded-full border border-fg-subtle" aria-hidden="true" />;
  return <span className="size-1.5 rounded-full bg-data" aria-hidden="true" />;
}

function Chip({ active = true, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-sm border px-1.5 text-[9px] font-medium tracking-[0.16em] phone:h-6 phone:rounded-full phone:px-2 phone:text-[10px] phone:tracking-[0.1em] ${
        active ? "border-data/40 text-data" : "border-line text-fg-subtle/60"
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
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9.5px] text-fg-subtle/90 lg:mt-3 lg:border-t lg:border-hairline lg:pt-2" title={details}>
      <span>
        <span className="mr-1.5 font-sans text-[9px] font-medium tracking-[0.2em]">CONTEXT</span>
        <span className={parts.length ? "text-data/80" : ""}>{parts.length ? parts.join(" · ") : "NONE"}</span>
      </span>
      {meta.focusLabel && <span className="max-w-[11rem] truncate text-accent/80">{meta.focusLabel}</span>}
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
      <div className="ml-10 rounded border border-accent/35 bg-elevated px-3 py-2.5 phone:ml-8 phone:rounded-[20px] phone:border-accent/25 phone:bg-material-selected phone:px-4 phone:py-3 lg:ml-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <p className="mb-1 text-[9.5px] font-medium tracking-[0.24em] text-accent/80 phone:text-[11px] phone:tracking-[0.18em] lg:mb-1.5">YOU</p>
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg phone:text-[16px] phone:leading-snug lg:text-[14.5px] lg:font-medium lg:leading-snug">{message.content}</p>
      </div>
    );
  }
  return (
    <div className="relative pl-3 lg:pl-4" aria-live={message.state === "streaming" ? "polite" : undefined}>
      <span className="absolute inset-y-0.5 left-0 w-px bg-data/50 lg:bg-gradient-to-b lg:from-data/60 lg:to-data/5" aria-hidden="true" />
      <p className="mb-1.5 flex items-center gap-2 text-[9.5px] font-medium tracking-[0.24em] text-fg-subtle phone:mb-2 phone:text-[11px] phone:tracking-[0.18em]">
        <span className="size-1.5 rounded-full bg-data" aria-hidden="true" />
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
  draft: draftProp,
  onDraftChange,
}: {
  chat: AiChat;
  /** Domains with loaded data. */
  domains: AiDomain[];
  /** Selected entity, if any. */
  focusLabel: string | null;
  /** Routes the question and builds its context at send time (current state). */
  prepare: PrepareAiRequest;
  onClose: () => void;
  /** Optional controlled draft (kept by Workspace so a tab switch does not lose it). */
  draft?: string;
  onDraftChange?: (draft: string) => void;
}) {
  const [localDraft, setLocalDraft] = useState("");
  const draft = draftProp ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
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

  // Desktop only: on touch screens focusing would raise the keyboard before the user asks.
  useEffect(() => {
    if (window.matchMedia("(width >= 64rem)").matches) inputRef.current?.focus();
  }, []);

  return (
    <aside aria-label="SMILEY" className="flex w-[380px] max-w-[42vw] shrink-0 flex-col border-l border-line bg-surface phone:bg-transparent max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:flex-1 max-lg:border-l-0 xl:w-[400px] lg:overflow-hidden lg:rounded-window lg:border lg:border-hairline lg:bg-material-panel lg:shadow-panel lg:backdrop-blur-material lg:backdrop-saturate-150 motion-safe:lg:animate-panel-in">
      <header className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-4 max-lg:gap-2 max-lg:pl-1.5 max-lg:pt-2 phone:items-center phone:gap-3 phone:border-hairline phone:px-5 phone:pb-4 phone:pt-4 lg:items-center lg:border-hairline lg:px-5 lg:py-4">
        <span className="hidden size-11 shrink-0 place-items-center rounded-2xl border border-hairline bg-material-group shadow-halo phone:grid lg:grid" aria-hidden="true">
          <SmileyMark size={26} />
        </span>
        {/* Compact (full-screen SMILEY): BACK returns to the map, which never unmounted. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to map"
          className="grid size-11 shrink-0 place-items-center rounded text-fg-muted transition-colors hover:text-accent phone:hidden lg:hidden"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 max-lg:pt-2 phone:pt-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-fg phone:text-[15px] phone:tracking-[0.26em] lg:text-[13px] lg:tracking-[0.26em]">
            <span className="text-accent phone:hidden lg:hidden" aria-hidden="true">◇</span>
            SMILEY
          </p>
          <p className="mt-1 text-[9.5px] font-medium tracking-[0.28em] text-fg-subtle phone:mt-1 phone:whitespace-nowrap phone:text-[10.5px] phone:tracking-[0.08em] lg:mt-1 lg:whitespace-nowrap lg:tracking-[0.14em]">AURELIS PERSONAL INTELLIGENCE</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted phone:text-[11px] phone:tracking-[0.14em]">
            <span className="flex items-center gap-2 phone:gap-1.5 phone:rounded-full phone:border phone:border-hairline phone:bg-material-group phone:px-2.5 phone:py-1 lg:gap-1.5 lg:rounded-full lg:border lg:border-hairline lg:bg-material-group lg:px-2 lg:py-0.5" role="status">
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
          className="h-7 shrink-0 rounded border border-line-strong px-2.5 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-accent/60 hover:text-accent disabled:pointer-events-none disabled:opacity-40 max-lg:mt-0.5 max-lg:h-11 max-lg:px-3.5 phone:mt-0 phone:self-start phone:rounded-full phone:border-hairline-strong phone:px-4 phone:text-[11px] lg:self-start lg:rounded-full lg:border-hairline-strong lg:px-3.5 lg:duration-150"
        >
          NEW
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close SMILEY"
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg max-lg:hidden lg:self-start lg:rounded-full lg:duration-150 lg:hover:bg-material-hover"
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 phone:px-5 phone:py-5 lg:px-5 lg:py-5"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center gap-6 py-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <SmileyMark />
              <p className="text-[11px] font-semibold tracking-[0.32em] text-fg phone:text-[12px] phone:text-fg-subtle lg:text-fg-subtle">SMILEY</p>
              <p className="max-w-[17rem] text-[12px] leading-relaxed text-fg-muted phone:max-w-[19rem] phone:font-display phone:text-[28px] phone:leading-[1.12] phone:text-fg lg:max-w-[18rem] lg:font-display lg:text-[24px] lg:leading-[1.15] lg:text-fg">
                Personal intelligence for your AURELIS dashboard.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 phone:gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="group flex items-center gap-2 rounded border border-deep bg-base/40 px-3 py-2.5 max-lg:py-3.5 phone:min-h-14 phone:gap-3 phone:rounded-[18px] phone:border-glass-line phone:bg-material-group phone:px-4 phone:text-[11.5px] phone:tracking-[0.12em] phone:active:scale-[0.99] phone:active:bg-material-hover lg:rounded-xl lg:border-hairline lg:bg-material-group lg:px-4 lg:py-3 lg:duration-150 lg:hover:border-accent/35 lg:hover:bg-material-hover text-left text-[10px] font-medium tracking-[0.18em] text-fg-muted transition-colors hover:border-accent/50 hover:text-fg"
                >
                  <span className="text-data/70 transition-colors group-hover:text-accent" aria-hidden="true">›</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 phone:gap-7 lg:gap-7">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 pb-3 pt-2.5 phone:border-hairline phone:px-4 phone:pb-2 phone:pt-3 lg:border-hairline lg:px-5 lg:pb-4 lg:pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-1" title="Domains with data loaded in AURELIS (sent only when a question needs them)">
          <span className="mr-1 text-[9px] font-medium tracking-[0.22em] text-fg-subtle phone:text-[10px] phone:tracking-[0.12em]">AVAILABLE</span>
          {DOMAINS.map((d) => (
            <Chip key={d.id} active={domains.includes(d.id)}>
              {d.label}
            </Chip>
          ))}
        </div>
        {focusLabel && (
          <div className="mb-2 flex items-center gap-2 rounded-sm border-l-2 border-accent bg-elevated px-2.5 py-1.5 lg:rounded-lg lg:border lg:border-accent/25 lg:bg-accent/[0.05]">
            <span className="text-[9px] font-medium tracking-[0.22em] text-fg-subtle">FOCUS</span>
            <span className="min-w-0 truncate text-[10.5px] font-medium tracking-[0.12em] text-accent">{focusLabel}</span>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="flex items-end gap-2 rounded border border-line-strong bg-base px-2.5 py-2 focus-within:border-data/50 phone:min-h-[3.25rem] phone:items-center phone:rounded-[24px] phone:border-glass-line phone:bg-glass-strong phone:py-1.5 phone:pl-4 phone:pr-1.5 phone:shadow-mobile phone:backdrop-blur-xl phone:focus-within:border-accent/40 lg:rounded-2xl lg:border-hairline-strong lg:bg-material-field lg:px-4 lg:py-2.5 lg:shadow-field lg:transition-colors lg:focus-within:border-data/40"
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
            className="min-h-6 flex-1 resize-none bg-transparent py-0.5 text-[12.5px] leading-relaxed text-fg outline-none max-lg:text-[16px] phone:placeholder:text-[15px] phone:placeholder:tracking-normal lg:text-[13.5px] placeholder:text-[10.5px] placeholder:tracking-[0.2em] placeholder:text-fg-subtle"
          />
          {busy ? (
            <button
              type="button"
              onClick={chat.stop}
              aria-label="Stop the answer"
              title="Stop"
              className="flex h-7 shrink-0 items-center gap-1.5 rounded border border-line-strong px-2 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-accent/60 hover:text-accent max-lg:h-11 max-lg:px-3 phone:rounded-full phone:text-[11px]"
            >
              <span className="size-2 rounded-[1px] bg-current" aria-hidden="true" />
              STOP
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className={`grid size-7 shrink-0 place-items-center rounded transition-colors max-lg:size-11 phone:rounded-full lg:size-8 lg:rounded-full ${
                canSend ? "text-accent hover:bg-elevated phone:text-base phone:shadow-halo phone:[background:var(--accent-fill)] lg:text-base lg:shadow-halo lg:[background:var(--accent-fill)] lg:hover:brightness-110" : "text-fg-subtle/50"
              }`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </form>
        <p className="mt-1.5 text-[9.5px] leading-snug text-fg-subtle/80 phone:mt-2 phone:px-1 phone:text-[11px]">
          Read-only. Interprets AURELIS data; it is not a source.
        </p>
      </div>
    </aside>
  );
}
