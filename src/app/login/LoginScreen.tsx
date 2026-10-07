"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginFailure } from "@/lib/auth-core";

type LoginState =
  | { kind: "idle" }
  | { kind: "authenticating" }
  | { kind: "error"; title: string; detail: string };

/** Deterministic, very faint star field (no randomness: same markup on server and client). */
const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 37.7) % 100,
  y: (i * 61.3 + 7) % 100,
  r: i % 7 === 0 ? 1.1 : 0.6,
  o: 0.12 + ((i * 13) % 5) * 0.05,
}));

/** Minimal globe + orbit (same language as the SMILEY mark), drawn very large and faint. */
function Globe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" aria-hidden="true" className={className}>
      <circle cx="200" cy="200" r="150" className="stroke-line-strong" strokeWidth="0.8" />
      <ellipse cx="200" cy="200" rx="150" ry="52" className="stroke-line" strokeWidth="0.7" />
      <ellipse cx="200" cy="200" rx="58" ry="150" className="stroke-line" strokeWidth="0.7" />
      <ellipse cx="200" cy="200" rx="112" ry="150" className="stroke-line" strokeWidth="0.7" />
      <path d="M50 200h300" className="stroke-line" strokeWidth="0.7" />
      <ellipse cx="200" cy="200" rx="196" ry="70" transform="rotate(-22 200 200)" className="stroke-cyan/40" strokeWidth="0.9" />
      <circle cx="374" cy="128" r="3" className="fill-cyan/80" />
      <circle cx="200" cy="200" r="2.2" className="fill-gold/80" />
    </svg>
  );
}

/** Small AURELIS mark: orbit + gold node (legible at icon size). */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" width="44" height="44" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="20" className="stroke-line-strong" strokeWidth="1.2" />
      <ellipse cx="32" cy="32" rx="29" ry="10" transform="rotate(-22 32 32)" className="stroke-cyan/70" strokeWidth="1.2" />
      <path d="M32 26l6 6-6 6-6-6z" className="stroke-gold" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="58" cy="22.5" r="2" className="fill-cyan" />
    </svg>
  );
}

function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[9.5px] font-medium tracking-[0.28em] text-fg-subtle">{label}</span>
      <input
        id={id}
        {...input}
        className="h-10 rounded border border-line-strong bg-base px-3 text-[13px] text-fg outline-none max-md:h-11 max-md:text-[16px] transition-colors placeholder:text-fg-subtle/60 focus:border-cyan/60 disabled:opacity-60"
      />
    </label>
  );
}

/**
 * AURELIS authorized-access screen (single user; no sign-up, no social login,
 * no password reset in this stage). The password lives only in this
 * component's state for the duration of the attempt; the session is set by
 * Supabase in cookies (SSR), never in custom storage.
 */
export default function LoginScreen({ unavailable }: { unavailable: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>(
    unavailable ? { kind: "error", title: "AUTH UNAVAILABLE", detail: "Authentication is not configured." } : { kind: "idle" },
  );
  const busy = state.kind === "authenticating";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !email.trim() || !password) return;
    const supabase = createClient();
    if (!supabase) {
      setState({ kind: "error", title: "AUTH UNAVAILABLE", detail: "Authentication is not configured." });
      return;
    }
    setState({ kind: "authenticating" });
    let failed: { status?: number } | null = null;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      failed = error;
    } catch {
      failed = { status: 0 };
    }
    setPassword("");
    if (failed) {
      setState({ kind: "error", ...loginFailure(failed) });
      return;
    }
    router.replace("/app");
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-base px-4 py-10 [@media(height<32rem)]:py-4">
      {/* Technical grid + stars + globe: background only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(var(--aurelis-border)_1px,transparent_1px),linear-gradient(90deg,var(--aurelis-border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
        {STARS.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="var(--aurelis-text)" opacity={s.o} />
        ))}
      </svg>
      <Globe className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[980px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-45 md:block" />

      <section className="relative z-10 w-full max-w-[400px]">
        <header className="mb-8 flex flex-col items-center text-center [@media(height<32rem)]:mb-4">
          <div className="mb-4 [@media(height<32rem)]:hidden">
            <Mark />
          </div>
          <p className="flex items-center gap-3">
            <span className="size-2 rotate-45 bg-gold" aria-hidden="true" />
            <span className="text-[22px] font-semibold tracking-[0.5em] text-fg">AURELIS</span>
          </p>
          <p className="mt-2 text-[9.5px] font-medium tracking-[0.3em] text-fg-subtle">
            PERSONAL GLOBAL SITUATIONAL DASHBOARD
          </p>
        </header>

        <form
          onSubmit={submit}
          className="rounded-md border border-line bg-surface/95 px-6 pb-6 pt-5 shadow-[0_0_0_1px_rgba(11,32,83,0.6)]"
          aria-describedby="login-status"
        >
          <p className="mb-5 flex items-center gap-2 text-[10px] font-medium tracking-[0.3em] text-fg-muted">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
            AUTHORIZED ACCESS
          </p>
          <div className="flex flex-col gap-4">
            <Field
              id="email"
              label="EMAIL"
              type="email"
              name="email"
              autoComplete="username"
              required
              disabled={busy || unavailable}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              id="password"
              label="PASSWORD"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              disabled={busy || unavailable}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={busy || unavailable}
            className="mt-6 flex h-10 w-full items-center justify-center rounded border border-gold/70 bg-gold/10 text-[10.5px] font-semibold tracking-[0.32em] text-gold transition-colors hover:bg-gold hover:text-base disabled:pointer-events-none disabled:opacity-60"
          >
            {busy ? "AUTHENTICATING..." : "ENTER AURELIS"}
          </button>

          <div id="login-status" role="status" aria-live="polite" className="min-h-[44px] pt-4">
            {state.kind === "error" && (
              <div className="rounded border border-line px-3 py-2">
                <p className="text-[10px] font-semibold tracking-[0.28em] text-gold">{state.title}</p>
                <p className="mt-0.5 text-[11.5px] text-fg-muted">{state.detail}</p>
              </div>
            )}
          </div>
        </form>

        <p className="mt-6 flex items-center justify-center gap-2 text-[9.5px] font-medium tracking-[0.3em] text-fg-subtle">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="1.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          SYSTEM LOCKED
        </p>
      </section>
    </main>
  );
}
