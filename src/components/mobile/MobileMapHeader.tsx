"use client";

import type { GlobalHealth } from "@/types";

const LABEL: Record<GlobalHealth, string> = {
  syncing: "SYNCING",
  live: "LIVE",
  partial: "PARTIAL",
  stale: "STALE",
  unavailable: "OFFLINE",
};

const GLASS = "border border-glass-line bg-glass shadow-mobile backdrop-blur-xl backdrop-saturate-150";

/**
 * MAP's floating toolbar (phone): the wordmark, the global data state (LIVE
 * capsule → Sources sheet) and Layers (the domain stack, unfolding right
 * under the button). Small and over the map, below the device's top safe
 * area — the map stays the window. LIVE is a data state: data color, never
 * the selection accent.
 */
export default function MobileMapHeader({
  health,
  domainLabel,
  onOpenStatus,
  layersOpen,
  onToggleLayers,
  children,
}: {
  health: GlobalHealth;
  /** The open domain (title case), or null for the world view. */
  domainLabel: string | null;
  onOpenStatus: () => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
  /** The Layers stack (LayersMenu), anchored under the button. */
  children: React.ReactNode;
}) {
  const live = health === "live";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[35] flex items-center gap-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] not-phone:hidden">
      <div className={`pointer-events-auto flex h-11 items-center gap-2.5 rounded-full pl-4 pr-4 ${GLASS}`}>
        <span className="size-2 rotate-45 [background:var(--accent-fill)]" aria-hidden="true" />
        <span className="text-[13px] font-semibold tracking-[0.34em] text-fg">AURELIS</span>
      </div>
      <button
        type="button"
        onClick={onOpenStatus}
        aria-label={`Data status: ${LABEL[health]}. Show sources`}
        className={`pointer-events-auto ml-auto flex h-11 items-center gap-2 rounded-full px-3.5 text-[11px] font-semibold tracking-[0.18em] transition-transform active:scale-[0.97] ${GLASS} ${
          live ? "text-live" : "text-fg-muted"
        }`}
      >
        <span
          className={`size-2 rounded-full ${live ? "bg-live shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-live)_20%,transparent)]" : "border border-fg-subtle"}`}
          aria-hidden="true"
        />
        {LABEL[health]}
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={onToggleLayers}
          aria-label={`Layers${domainLabel ? `: ${domainLabel}` : ""}`}
          aria-expanded={layersOpen}
          aria-controls="aurelis-layers"
          className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full pl-3.5 pr-4 text-[13px] font-medium text-fg transition-transform active:scale-[0.97] ${GLASS} ${
            layersOpen ? "ring-1 ring-accent/45" : ""
          }`}
        >
          <svg className="text-accent" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.5l8.5 4.5-8.5 4.5-8.5-4.5z" />
            <path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
          </svg>
          {domainLabel ?? "Layers"}
        </button>
        {children}
      </div>
    </div>
  );
}
