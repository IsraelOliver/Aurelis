import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatAgo } from "@/lib/format";
import type { SourceHealth } from "@/types";
import type { DomainId } from "@/components/Workspace";
import CategoryIcon from "./CategoryIcon";

export interface SidebarSource {
  id: string;
  name: string;
  health: SourceHealth;
  /** Age of the shown snapshot (from ingestedAt); null when there is none. */
  ageMs: number | null;
}

/** Categories that open a domain panel (global, non-geographic data). */
const DOMAIN_PANELS: Record<string, DomainId> = { space: "space", disasters: "disasters", weather: "weather", air: "air" };

const ROW =
  "group relative flex h-9 w-full items-center gap-3 rounded px-3 text-left text-fg-muted transition-colors hover:bg-elevated hover:text-fg data-[active=true]:bg-deep data-[active=true]:text-fg";

function HealthDot({ health }: { health: SourceHealth }) {
  return (
    <span
      className={`size-1.5 shrink-0 rounded-full ${health === "fresh" ? "bg-cyan" : "border border-fg-subtle"}`}
      aria-hidden="true"
    />
  );
}

/**
 * Layer list. Categories are not wired to filters yet. AIR, SPACE, WEATHER
 * and DISASTERS open their domain panels; `data-active` (gold bar + deep blue) marks the open
 * domain panel. The other rows stay inert, so none pretends to be filtering.
 * Collapsible to an icon rail (session state, not persisted): labels move to
 * tooltips and sources become one health dot each.
 */
export default function Sidebar({
  sources,
  activeDomain,
  onOpenDomain,
  aiOpen,
  onToggleAi,
}: {
  sources: SidebarSource[];
  activeDomain: DomainId | null;
  onOpenDomain: (domain: DomainId) => void;
  /** SMILEY panel open (personal intelligence; separate from the domains). */
  aiOpen: boolean;
  onToggleAi: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className={`flex h-10 items-center ${collapsed ? "justify-center" : "justify-between pl-4 pr-2"}`}>
        {!collapsed && (
          <span className="text-[10px] font-medium tracking-[0.28em] text-fg-subtle">LAYERS</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-7 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
          </svg>
        </button>
      </div>

      <ul className="flex flex-col gap-px px-2">
        {CATEGORIES.map((category) => {
          const domain = DOMAIN_PANELS[category.id];
          const isDomain = domain !== undefined;
          const hint = isDomain ? `Open ${category.label} panel` : "Layer controls not available yet";
          const content = (
            <>
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold opacity-0 group-data-[active=true]:opacity-100" />
              <span className="text-fg-subtle transition-colors group-hover:text-fg-muted">
                <CategoryIcon id={category.id} />
              </span>
              {collapsed ? (
                <span className="sr-only">{category.label}</span>
              ) : (
                <>
                  <span className="text-[11px] font-medium tracking-[0.16em]">{category.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-fg-subtle">—</span>
                </>
              )}
            </>
          );
          const rowClass = collapsed ? `${ROW} justify-center px-0` : ROW;
          return (
            <li key={category.id}>
              {isDomain ? (
                <button
                  type="button"
                  className={rowClass}
                  data-active={activeDomain === category.id}
                  aria-pressed={activeDomain === category.id}
                  title={collapsed ? `${category.label} — ${hint}` : hint}
                  onClick={() => onOpenDomain(domain)}
                >
                  {content}
                </button>
              ) : (
                <div className={rowClass} title={collapsed ? `${category.label} — ${hint}` : hint}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* SMILEY: personal intelligence over the domains, not one of them (discreet divider). */}
      <div className="mt-auto border-t border-line px-2 py-2">
        <button
          type="button"
          className={collapsed ? `${ROW} justify-center px-0` : ROW}
          data-active={aiOpen}
          aria-pressed={aiOpen}
          title={collapsed ? "SMILEY — AURELIS personal intelligence" : "Open SMILEY (AURELIS personal intelligence)"}
          onClick={onToggleAi}
        >
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold opacity-0 group-data-[active=true]:opacity-100" />
          <span className="text-gold/80 transition-colors group-hover:text-gold">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          {collapsed ? (
            <span className="sr-only">SMILEY</span>
          ) : (
            <span className="text-[11px] font-medium tracking-[0.16em]">SMILEY</span>
          )}
        </button>
      </div>

      {collapsed ? (
        <ul className="flex flex-col items-center gap-2 border-t border-line py-3" aria-label="Sources">
          {sources.map((source) => (
            <li
              key={source.id}
              className="grid size-4 place-items-center"
              title={`${source.name}: ${source.health.toUpperCase()}${
                source.ageMs !== null ? ` · updated ${formatAgo(source.ageMs)}` : ""
              }`}
            >
              <HealthDot health={source.health} />
              <span className="sr-only">
                {source.name}: {source.health}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-fg-subtle">
          <p className="text-[10px] font-medium tracking-[0.2em]">SOURCES</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {sources.map((source) => (
              <li key={source.id}>
                <span className="text-fg-muted">{source.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-medium tracking-[0.16em]">
                  <HealthDot health={source.health} />
                  {source.health.toUpperCase()}
                  {source.ageMs !== null && (
                    <span className="font-mono tracking-normal">
                      · UPDATED {formatAgo(source.ageMs).toUpperCase()}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
