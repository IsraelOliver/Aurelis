"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-out: clears the Supabase cookie session; the full navigation to /login
 * then drops all client state. Shared by every session control (desktop,
 * drawer, phone Settings).
 */
export function useLogout() {
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    try {
      await createClient()?.auth.signOut();
    } finally {
      window.location.replace("/login");
    }
  }
  return { leaving, logout };
}

/**
 * AUTHORIZED + LOG OUT (no email or name shown).
 * `desktop`: the refined desktop sidebar footer (same behavior).
 */
export default function SessionControl({ collapsed, desktop = false }: { collapsed: boolean; desktop?: boolean }) {
  const { leaving, logout } = useLogout();

  const icon = (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4-4-4M14 12H4" />
    </svg>
  );

  if (desktop) {
    return collapsed ? (
      <div className="flex justify-center py-3">
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          title="Authorized · Log out"
          aria-label="Log out"
          className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors duration-150 hover:bg-material-hover hover:text-accent disabled:opacity-50"
        >
          {icon}
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-2.5 py-3 pl-4 pr-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline-strong bg-material-group shadow-thumb" aria-hidden="true">
          <span className="size-1.5 rotate-45 bg-accent" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[12px] font-medium text-fg">Authorized</span>
          <span className="truncate text-[10.5px] text-fg-subtle">Private session</span>
        </span>
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          title="Log out"
          className="ml-auto flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline-strong px-3 text-[11px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          {icon}
          {leaving ? "Logging out…" : "Log out"}
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-line py-2.5">
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          title="Authorized · Log out"
          aria-label="Log out"
          className="grid size-7 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-accent disabled:opacity-50"
        >
          {icon}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[9.5px] font-medium tracking-[0.22em] text-fg-subtle">
        <span className="size-1.5 rotate-45 bg-accent/80" aria-hidden="true" />
        AUTHORIZED
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={leaving}
        className="flex h-6 items-center gap-1.5 rounded border border-line px-2 text-[9px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-accent/60 hover:text-accent disabled:opacity-50 max-lg:h-10 max-lg:px-3"
      >
        {icon}
        {leaving ? "LOGGING OUT…" : "LOG OUT"}
      </button>
    </div>
  );
}
