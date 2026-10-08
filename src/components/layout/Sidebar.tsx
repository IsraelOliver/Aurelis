import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatAgo } from "@/lib/format";
import type { SourceHealth } from "@/types";
import type { DomainId } from "@/components/Workspace";
import CategoryIcon from "./CategoryIcon";
import SessionControl from "./SessionControl";

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
  "group relative flex w-full items-center gap-3 rounded px-3 text-left text-fg-muted transition-colors hover:bg-elevated hover:text-fg data-[active=true]:bg-deep data-[active=true]:text-fg";

function HealthDot({ health }: { health: SourceHealth }) {
  return (
    <span
      className={`size-1.5 shrink-0 rounded-full ${health === "fresh" ? "bg-data" : "border border-fg-subtle"}`}
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
 * Two placements, one implementation: "rail" is the desktop column (`lg` and
 * up); "drawer" is the same content inside the compact-layout navigation
 * drawer (full labels, 44 px rows, plus the status line the compact layout
 * does not show elsewhere).
 */
export default function Sidebar({
  sources,
  activeDomain,
  onOpenDomain,
  aiOpen,
  onToggleAi,
  variant = "rail",
  status,
  onClose,
}: {
  sources: SidebarSource[];
  activeDomain: DomainId | null;
  onOpenDomain: (domain: DomainId) => void;
  /** SMILEY panel open (personal intelligence; separate from the domains). */
  aiOpen: boolean;
  onToggleAi: () => void;
  variant?: "rail" | "drawer";
  /** Drawer only: SOURCES / ENTITIES / STATUS line. */
  status?: React.ReactNode;
  /** Drawer only. */
  onClose?: () => void;
}) {
  const drawer = variant === "drawer";
  const [railCollapsed, setCollapsed] = useState(false);
  const collapsed = !drawer && railCollapsed;
  const rowHeight = drawer ? "h-11" : "h-9";

  return (
    <aside
      className={
        drawer
          ? "flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-surface"
          : `hidden shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? "w-14" : "w-56"}`
      }
    >
      <div className={`flex shrink-0 items-center ${drawer ? "h-12" : "h-10"} ${collapsed ? "justify-center" : "justify-between pl-4 pr-2"}`}>
        {!collapsed && (
          <span className="text-[10px] font-medium tracking-[0.28em] text-fg-subtle">LAYERS</span>
        )}
        {drawer ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-11 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
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
        )}
      </div>

      <ul className="flex flex-col gap-px px-2">
        {CATEGORIES.map((category) => {
          const domain = DOMAIN_PANELS[category.id];
          const isDomain = domain !== undefined;
          const hint = isDomain ? `Open ${category.label} panel` : "Layer controls not available yet";
          const content = (
            <>
              <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent opacity-0 group-data-[active=true]:opacity-100" />
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
          const rowClass = collapsed ? `${ROW} ${rowHeight} justify-center px-0` : `${ROW} ${rowHeight}`;
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
          className={collapsed ? `${ROW} ${rowHeight} justify-center px-0` : `${ROW} ${rowHeight}`}
          data-active={aiOpen}
          aria-pressed={aiOpen}
          title={collapsed ? "SMILEY — AURELIS personal intelligence" : "Open SMILEY (AURELIS personal intelligence)"}
          onClick={onToggleAi}
        >
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent opacity-0 group-data-[active=true]:opacity-100" />
          <span className="text-accent/80 transition-colors group-hover:text-accent">
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

      {status}
      {/* AUTHORIZED / LOG OUT stays reachable however long the list above grows (short screens). */}
      <div className="sticky bottom-0 bg-surface">
        <SessionControl collapsed={collapsed} />
      </div>
    </aside>
  );
}
