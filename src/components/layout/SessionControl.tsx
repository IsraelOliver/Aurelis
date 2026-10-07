"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * AUTHORIZED + LOG OUT (no email or name shown). Sign-out clears the Supabase
 * cookie session; the full navigation to /login then drops all client state.
 */
export default function SessionControl({ collapsed }: { collapsed: boolean }) {
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

  const icon = (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4-4-4M14 12H4" />
    </svg>
  );

  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-line py-2.5">
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          title="Authorized · Log out"
          aria-label="Log out"
          className="grid size-7 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-gold disabled:opacity-50"
        >
          {icon}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[9.5px] font-medium tracking-[0.22em] text-fg-subtle">
        <span className="size-1.5 rotate-45 bg-gold/80" aria-hidden="true" />
        AUTHORIZED
      </span>
      <button
        type="button"
        onClick={logout}
        disabled={leaving}
        className="flex h-6 items-center gap-1.5 rounded border border-line px-2 text-[9px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
      >
        {icon}
        {leaving ? "LOGGING OUT…" : "LOG OUT"}
      </button>
    </div>
  );
}
