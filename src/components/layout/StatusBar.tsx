import type { GlobalHealth } from "@/types";

const STATUS_BY_HEALTH: Record<GlobalHealth, string> = {
  syncing: "SYNCING",
  live: "NOMINAL",
  partial: "DEGRADED",
  stale: "DEGRADED",
  unavailable: "DEGRADED",
};

function Item({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-2 px-4 first:pl-0">
      <span className="text-fg-subtle">{label}</span>
      <span className="font-mono text-fg-muted">{value}</span>
    </span>
  );
}

/**
 * SOURCES: sources with a usable snapshot. ENTITIES: sum of current entities
 * across those snapshots (not observations). Zero until a snapshot exists.
 */
export default function StatusBar({
  sourceCount,
  entityCount,
  health,
}: {
  sourceCount: number;
  entityCount: number;
  health: GlobalHealth;
}) {
  return (
    <footer className="hidden h-7 shrink-0 items-center border-t border-line bg-base px-4 text-[10px] font-medium tracking-[0.2em] lg:flex">
      <div className="flex items-center divide-x divide-line">
        <Item label="SOURCES" value={String(sourceCount)} />
        <Item label="ENTITIES" value={String(entityCount)} />
      </div>
      <div className="ml-auto flex items-center" role="status">
        <Item label="STATUS" value={STATUS_BY_HEALTH[health]} />
      </div>
    </footer>
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
