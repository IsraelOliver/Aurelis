import type { SourceHealth } from "@/types";

const STATUS_BY_HEALTH: Record<SourceHealth, string> = {
  syncing: "SYNCING",
  fresh: "NOMINAL",
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

/** Counts reflect the snapshot actually held; zero until one exists. */
export default function StatusBar({
  sourceCount,
  entityCount,
  health,
}: {
  sourceCount: number;
  entityCount: number;
  health: SourceHealth;
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center border-t border-line bg-base px-4 text-[10px] font-medium tracking-[0.2em]">
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
