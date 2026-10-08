import { useState } from "react";
import type { GlobalHealth } from "@/types";

const SYNC_INDICATOR: Record<
  GlobalHealth,
  { label: string; title: string; active: boolean }
> = {
  syncing: {
    label: "SYNCING",
    title: "Obtaining the first snapshots",
    active: false,
  },
  live: {
    label: "LIVE",
    title: "Continuous synchronization active for all sources",
    active: true,
  },
  partial: {
    label: "PARTIAL",
    title: "Some sources are current, others are stale or unavailable",
    active: false,
  },
  stale: {
    label: "STALE",
    title: "Showing the last known snapshots; they may be out of date",
    active: false,
  },
  unavailable: {
    label: "UNAVAILABLE",
    title: "No data could be loaded in this session",
    active: false,
  },
};

/** Visual only: search is not implemented yet. */
function SearchField({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <label className="flex h-8 items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-fg-subtle transition-colors hover:not-focus-within:border-line-strong focus-within:border-cyan/50 focus-within:text-cyan/80 max-md:h-10">
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
      </svg>
      <input
        type="search"
        placeholder="Search..."
        aria-label="Search (not available yet)"
        autoFocus={autoFocus}
        className="w-full bg-transparent text-[12.5px] text-fg placeholder:text-fg-subtle focus:outline-none max-md:text-[16px]"
      />
    </label>
  );
}

/**
 * Desktop (`lg`+): wordmark, centred search, status — unchanged. Compact:
 * a MENU button opens the navigation drawer; below `md` the search becomes an
 * icon that opens the same field in a row under the header.
 */
export default function Topbar({
  health,
  sourceSummary,
  onOpenMenu,
}: {
  health: GlobalHealth;
  /** Per-source states, e.g. "USGS Earthquakes: FRESH · Where The ISS At?: STALE". */
  sourceSummary: string;
  /** Compact layout: opens the navigation drawer. */
  onOpenMenu: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const base = SYNC_INDICATOR[health];
  const indicator = { ...base, title: `${base.title}. ${sourceSummary}` };

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-6 border-b border-line bg-base px-4 max-lg:h-[calc(3rem+env(safe-area-inset-top))] max-lg:gap-3 max-lg:pl-[max(0.25rem,env(safe-area-inset-left))] max-lg:pr-[max(0.75rem,env(safe-area-inset-right))] max-lg:pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="group grid size-11 shrink-0 place-items-center rounded text-fg-muted transition-colors hover:text-fg lg:hidden"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16" className="stroke-current" />
          <path d="M4 12h11" className="stroke-current" />
          <path d="M4 17h16" className="stroke-current" />
          <rect x="17.4" y="10.4" width="3.2" height="3.2" transform="rotate(45 19 12)" className="fill-gold stroke-none" />
        </svg>
      </button>
      <div className="flex shrink-0 items-center gap-2.5 lg:w-52">
        <span className="size-1.5 rotate-45 bg-gold" aria-hidden="true" />
        <span className="text-[13px] font-semibold tracking-[0.42em] text-fg">
          AURELIS
        </span>
        <span className="hidden font-mono text-[9px] text-fg-subtle sm:inline">
          v1.0
        </span>
      </div>

      <div className="mx-auto w-full max-w-lg max-md:hidden">
        <SearchField />
      </div>
      <button
        type="button"
        onClick={() => setSearchOpen((o) => !o)}
        aria-label={searchOpen ? "Close search" : "Open search"}
        aria-expanded={searchOpen}
        className={`ml-auto grid size-11 shrink-0 place-items-center rounded transition-colors md:hidden ${searchOpen ? "text-gold" : "text-fg-subtle hover:text-fg"}`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
      </button>
      {searchOpen && (
        <div className="absolute inset-x-0 top-full border-b border-line bg-base px-3 py-2 md:hidden">
          <SearchField autoFocus />
        </div>
      )}

      {/* Solid cyan dot only when fresh; otherwise hollow gray (shape + text, not only color). */}
      <div
        role="status"
        className={`flex shrink-0 items-center justify-end gap-2 text-[10px] font-medium tracking-[0.24em] lg:w-52 ${
          indicator.active ? "text-cyan" : "text-fg-subtle"
        }`}
        title={indicator.title}
      >
        <span
          className={`size-2 rounded-full ${
            indicator.active ? "bg-cyan" : "border border-fg-subtle"
          }`}
          aria-hidden="true"
        />
        {indicator.label}
        <span className="sr-only">({indicator.title})</span>
      </div>
    </header>
  );
}
