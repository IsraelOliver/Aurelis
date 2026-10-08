import type { GlobalHealth } from "@/types";

const STATUS_BY_HEALTH: Record<GlobalHealth, string> = {
  syncing: "SYNCING",
  live: "NOMINAL",
  partial: "DEGRADED",
  stale: "DEGRADED",
  unavailable: "DEGRADED",
};

const n0 = new Intl.NumberFormat("en-US");

/**
 * Desktop status (AURELIS 1.1): SOURCES / ENTITIES / STATUS as a compact block
 * in the sidebar footer instead of a full-width bar. SOURCES: sources with a
 * usable snapshot. ENTITIES: current entities across those snapshots (not
 * observations). Collapsed rail: one status dot with the figures in its title.
 */
export default function StatusBar({
  sourceCount,
  entityCount,
  health,
  collapsed = false,
}: {
  sourceCount: number;
  entityCount: number;
  health: GlobalHealth;
  collapsed?: boolean;
}) {
  const status = STATUS_BY_HEALTH[health];
  const nominal = health === "live";
  const dot = (
    <span className={`size-1.5 shrink-0 rounded-full ${nominal ? "bg-data shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-data)_18%,transparent)]" : "border border-fg-subtle"}`} aria-hidden="true" />
  );
  const figures = `${sourceCount} sources · ${n0.format(entityCount)} entities`;
  if (collapsed) {
    return (
      <div role="status" className="flex justify-center py-2" title={`Status ${status} · ${figures}`}>
        {dot}
        <span className="sr-only">
          Status {status}, {figures}
        </span>
      </div>
    );
  }
  return (
    <div role="status" className="mx-3 mb-1 rounded-2xl border border-hairline bg-material-group px-3.5 pb-2.5 pt-2.5 shadow-thumb">
      <span className="flex items-center gap-2 text-[9.5px] font-medium tracking-[0.22em] text-fg-subtle">
        SYSTEM
        <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
        {dot}
      </span>
      <span className="mt-1 block font-display text-[21px] leading-none text-fg">
        {status.charAt(0) + status.slice(1).toLowerCase()}
        <span className="sr-only"> ({status})</span>
      </span>
      <span className="mt-1.5 block font-mono text-[10.5px] text-fg-subtle" title="Sources with a usable snapshot · current entities">
        {figures}
      </span>
    </div>
  );
}

/** Same figures for the compact-layout drawer (the status bar is desktop-only). */
export function StatusSummary({
  sourceCount,
  entityCount,
  health,
}: {
  sourceCount: number;
  entityCount: number;
  health: GlobalHealth;
}) {
  return (
    <dl className="grid grid-cols-3 border-t border-line px-4 py-3 text-[9.5px] font-medium tracking-[0.2em]">
      {[
        ["SOURCES", String(sourceCount)],
        ["ENTITIES", String(entityCount)],
        ["STATUS", STATUS_BY_HEALTH[health]],
      ].map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-fg-subtle">{label}</dt>
          <dd className="font-mono text-[11px] tracking-normal text-fg-muted">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
