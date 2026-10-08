"use client";

import type { GlobalHealth } from "@/types";
import { formatAgo } from "@/lib/format";
import { STATUS_BY_HEALTH } from "@/components/layout/StatusBar";
import type { SidebarSource } from "@/components/layout/Sidebar";
import MobileSheet from "./MobileSheet";

const n0 = new Intl.NumberFormat("en-US");

/** Global status + every source with its freshness (phone). Same figures as the desktop status block. */
export function SourceList({ sources }: { sources: SidebarSource[] }) {
  return (
    <ul className="divide-y divide-hairline">
      {sources.map((s) => {
        const fresh = s.health === "fresh";
        return (
          <li key={s.id} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
            <span
              className={`size-2 shrink-0 rounded-full ${fresh ? "bg-data" : "border border-fg-subtle"}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 text-[14px] leading-snug text-fg">{s.name}</span>
            <span className={`shrink-0 font-mono text-[12px] ${fresh ? "text-fg-muted" : "text-fg"}`}>
              {fresh ? (s.ageMs !== null ? formatAgo(s.ageMs) : "") : s.health.toUpperCase()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The global data state as a small readout: state word, figures. */
export function StatusReadout({
  health,
  sourceCount,
  entityCount,
}: {
  health: GlobalHealth;
  sourceCount: number;
  entityCount: number;
}) {
  const status = STATUS_BY_HEALTH[health];
  const nominal = health === "live";
  return (
    <div role="status" className="flex items-center gap-4 px-4 py-4">
      <span
        className={`size-2.5 shrink-0 rounded-full ${nominal ? "bg-data shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-data)_18%,transparent)]" : "border border-fg-subtle"}`}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-[26px] leading-none text-fg">{status.charAt(0) + status.slice(1).toLowerCase()}</span>
        <span className="mt-1.5 font-mono text-[12px] text-fg-muted">
          {sourceCount} sources · {n0.format(entityCount)} entities
        </span>
      </span>
    </div>
  );
}

/**
 * Sources (phone): opened from the LIVE capsule. The global state and every
 * source with its freshness — degraded ones read in full text, not color only.
 */
export default function SourceStatusSheet({
  open,
  onClose,
  health,
  sources,
  sourceCount,
  entityCount,
}: {
  open: boolean;
  onClose: () => void;
  health: GlobalHealth;
  sources: SidebarSource[];
  sourceCount: number;
  entityCount: number;
}) {
  const fresh = sources.filter((s) => s.health === "fresh").length;
  return (
    <MobileSheet open={open} onClose={onClose} eyebrow="DATA" title="Sources">
      <div className="overflow-hidden rounded-[22px] border border-glass-line bg-material-group">
        <StatusReadout health={health} sourceCount={sourceCount} entityCount={entityCount} />
      </div>
      <p className="mb-2 mt-5 flex items-center px-2 text-[11px] font-medium tracking-[0.2em] text-fg-subtle">
        SOURCES
        <span className="ml-auto font-mono text-[12px] tracking-normal text-data">
          {fresh}/{sources.length} fresh
        </span>
      </p>
      <div className="mb-2 overflow-hidden rounded-[22px] border border-glass-line bg-material-group">
        <SourceList sources={sources} />
      </div>
    </MobileSheet>
  );
}
