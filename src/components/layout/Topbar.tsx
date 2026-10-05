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

export default function Topbar({
  health,
  sourceSummary,
}: {
  health: GlobalHealth;
  /** Per-source states, e.g. "USGS Earthquakes: FRESH · Where The ISS At?: STALE". */
  sourceSummary: string;
}) {
  const base = SYNC_INDICATOR[health];
  const indicator = { ...base, title: `${base.title}. ${sourceSummary}` };

  return (
    <header className="relative z-10 flex h-12 shrink-0 items-center gap-6 border-b border-line bg-base px-4">
      <div className="flex shrink-0 items-center gap-2.5 md:w-52">
        <span className="size-1.5 rotate-45 bg-gold" aria-hidden="true" />
        <span className="text-[13px] font-semibold tracking-[0.42em] text-fg">
          AURELIS
        </span>
        <span className="hidden font-mono text-[9px] text-fg-subtle sm:inline">
          v0.1
        </span>
      </div>

      {/* Visual only: search is not implemented yet. */}
      <div className="mx-auto w-full max-w-lg">
        <label className="flex h-8 items-center gap-2.5 rounded-md border border-line bg-surface px-3 text-fg-subtle transition-colors hover:not-focus-within:border-line-strong focus-within:border-cyan/50 focus-within:text-cyan/80">
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
            className="w-full bg-transparent text-[12.5px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </label>
      </div>

      {/* Solid cyan dot only when fresh; otherwise hollow gray (shape + text, not only color). */}
      <div
        role="status"
        className={`flex shrink-0 items-center justify-end gap-2 text-[10px] font-medium tracking-[0.24em] md:w-52 ${
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
