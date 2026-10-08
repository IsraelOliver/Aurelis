"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatAgo } from "@/lib/format";
import type { DomainId } from "@/components/Workspace";
import CategoryIcon from "./CategoryIcon";
import SessionControl from "./SessionControl";
import type { SidebarSource } from "./Sidebar";

/** Categories that open a domain panel (global, non-geographic data). */
const DOMAIN_PANELS: Record<string, DomainId> = { space: "space", disasters: "disasters", weather: "weather", air: "air" };

/** "DISASTERS" → "Disasters" (sidebar labels only; ids and panels keep their names). */
const titleCase = (label: string) => label.charAt(0) + label.slice(1).toLowerCase();

/** "NOAA SWPC — Planetary Kp" → { provider: "NOAA SWPC", label: "Planetary Kp" }. */
function splitSource(name: string): { provider: string | null; label: string } {
  const i = name.indexOf(" — ");
  return i < 0 ? { provider: null, label: name } : { provider: name.slice(0, i), label: name.slice(i + 3) };
}

const ROW =
  "group relative flex w-full items-center gap-3 rounded-xl text-left transition-colors duration-150";

function GroupLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 px-5 pb-2 pt-5 text-[9.5px] font-medium tracking-[0.24em] text-fg-subtle">
      {children}
      <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
      {aside && <span className="font-mono text-[10px] tracking-normal">{aside}</span>}
    </p>
  );
}

/**
 * Desktop navigation (AURELIS 1.1, `lg` and up): part of the window itself
 * (no box), like a native Mac sidebar — grouped domains, SMILEY in its own
 * group, compact sources grouped by provider, status and session at the
 * bottom. Collapsible to an icon rail (session state, not persisted). The
 * compact layouts keep their own drawer (Sidebar, variant "drawer").
 */
export default function DesktopSidebar({
  sources,
  activeDomain,
  onOpenDomain,
  aiOpen,
  onToggleAi,
  status,
}: {
  sources: SidebarSource[];
  activeDomain: DomainId | null;
  onOpenDomain: (domain: DomainId) => void;
  aiOpen: boolean;
  onToggleAi: () => void;
  /** Status block (StatusBar), given the collapsed state. */
  status: (collapsed: boolean) => React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const fresh = sources.filter((s) => s.health === "fresh").length;

  // Sources grouped by provider, in order of first appearance; a provider with one source stays one row.
  const groups: { provider: string | null; items: (SidebarSource & { label: string })[] }[] = [];
  for (const s of sources) {
    const { provider, label } = splitSource(s.name);
    const g = provider ? groups.find((x) => x.provider === provider) : undefined;
    if (g) g.items.push({ ...s, label });
    else groups.push({ provider, items: [{ ...s, label }] });
  }

  const sourceTitle = (s: SidebarSource) =>
    `${s.name}: ${s.health.toUpperCase()}${s.ageMs !== null ? ` · updated ${formatAgo(s.ageMs)}` : ""}`;
  const dot = (s: SidebarSource) => (
    <span
      className={`size-1.5 shrink-0 rounded-full ${s.health === "fresh" ? "bg-data" : "border border-fg-subtle"}`}
      aria-hidden="true"
    />
  );

  return (
    <aside
      aria-label="Navigation"
      className={`hidden shrink-0 flex-col overflow-y-auto overscroll-contain transition-[width] duration-200 lg:flex ${collapsed ? "w-[3.75rem]" : "w-60"}`}
    >
      <div className={`flex h-10 shrink-0 items-center ${collapsed ? "justify-center" : "gap-2.5 pl-5 pr-3"}`}>
        {!collapsed && (
          <>
            <span className="text-[9.5px] font-medium tracking-[0.24em] text-fg-subtle">LAYERS</span>
            <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
          </>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-150 hover:bg-material-hover hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
            <path d={collapsed ? "M9 5v14" : "M9 5v14M14 10l-2 2 2 2"} />
          </svg>
        </button>
      </div>

      <ul className={`flex flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}>
        {CATEGORIES.map((category) => {
          const domain = DOMAIN_PANELS[category.id];
          const isDomain = domain !== undefined;
          const active = isDomain && activeDomain === category.id;
          const label = titleCase(category.label);
          const hint = isDomain ? `Open ${category.label} panel` : "Layer controls not available yet";
          const shape = collapsed ? `${ROW} h-9 justify-center` : `${ROW} h-9 px-3`;
          const content = (
            <>
              <span className={`transition-colors duration-150 ${active ? "text-accent" : isDomain ? "text-fg-muted group-hover:text-fg" : "text-fg-subtle/60"}`}>
                <CategoryIcon id={category.id} />
              </span>
              {collapsed ? (
                <span className="sr-only">{category.label}</span>
              ) : (
                <span className={`text-[13px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
              )}
              {active && <span className="absolute inset-y-2.5 left-0 w-[2px] rounded-full [background:var(--accent-fill)]" aria-hidden="true" />}
            </>
          );
          return (
            <li key={category.id}>
              {isDomain ? (
                <button
                  type="button"
                  className={`${shape} ${active ? "text-fg [background:var(--nav-selected)]" : "text-fg-muted hover:bg-material-hover hover:text-fg"}`}
                  aria-pressed={active}
                  title={collapsed ? `${label} — ${hint}` : hint}
                  onClick={() => onOpenDomain(domain)}
                >
                  {content}
                </button>
              ) : (
                <div className={`${shape} cursor-default text-fg-subtle/70`} title={collapsed ? `${label} — ${hint}` : hint}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!collapsed && <GroupLabel>INTELLIGENCE</GroupLabel>}
      <div className={collapsed ? "mt-3 border-t border-hairline px-2 pt-3" : "px-3"}>
        <button
          type="button"
          className={`${collapsed ? `${ROW} h-9 justify-center` : `${ROW} h-[3.25rem] border px-2.5`} ${
            aiOpen
              ? "border-accent/35 bg-accent/[0.08] text-fg shadow-thumb"
              : "border-hairline bg-material-group text-fg-muted hover:border-hairline-strong hover:bg-material-hover hover:text-fg"
          }`}
          aria-pressed={aiOpen}
          title={collapsed ? "SMILEY — AURELIS personal intelligence" : "Open SMILEY (AURELIS personal intelligence)"}
          onClick={onToggleAi}
        >
          <span className={collapsed ? "text-accent" : `grid size-8 shrink-0 place-items-center rounded-lg border border-hairline bg-material-field text-accent ${aiOpen ? "shadow-halo" : ""}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          {collapsed ? (
            <span className="sr-only">SMILEY</span>
          ) : (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[11.5px] font-semibold tracking-[0.24em] text-fg">SMILEY</span>
              <span className="mt-0.5 text-[11px] text-fg-subtle">Personal intelligence</span>
            </span>
          )}
        </button>
      </div>

      {collapsed ? (
        <ul className="mt-3 flex flex-col items-center gap-2 border-t border-hairline py-3" aria-label="Sources">
          {sources.map((s) => (
            <li key={s.id} className="grid size-4 place-items-center" title={sourceTitle(s)}>
              {dot(s)}
              <span className="sr-only">{sourceTitle(s)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <GroupLabel aside={<span className="text-data">{`${fresh}/${sources.length}`}</span>}>SOURCES</GroupLabel>
          <ul className="flex flex-col px-3" aria-label="Sources">
            {groups.map((g) =>
              g.items.length > 1 && g.provider ? (
                <li key={g.provider}>
                  <p className="truncate px-2.5 pb-0.5 pt-1.5 text-[10.5px] font-medium text-fg-subtle">{g.provider}</p>
                  <ul>
                    {g.items.map((s) => (
                      <SourceRow key={s.id} source={s} label={s.label} title={sourceTitle(s)} dot={dot(s)} indent />
                    ))}
                  </ul>
                </li>
              ) : (
                <SourceRow key={g.items[0].id} source={g.items[0]} label={g.items[0].name} title={sourceTitle(g.items[0])} dot={dot(g.items[0])} />
              ),
            )}
          </ul>
        </>
      )}

      {/* Status + session stay reachable however long the lists above grow. */}
      <div className="sticky bottom-0 mt-auto border-t border-hairline bg-base/85 pt-3 backdrop-blur-md">
        {status(collapsed)}
        <SessionControl collapsed={collapsed} desktop />
      </div>
    </aside>
  );
}

/** One source: health dot, name, freshness (age when fresh, the state word otherwise). */
function SourceRow({
  source,
  label,
  title,
  dot,
  indent = false,
}: {
  source: SidebarSource;
  label: string;
  title: string;
  dot: React.ReactNode;
  indent?: boolean;
}) {
  const fresh = source.health === "fresh";
  return (
    <li className={`flex h-6 items-center gap-2 rounded-md pr-2.5 ${indent ? "pl-4" : "pl-2.5"}`} title={title}>
      {dot}
      <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">{label}</span>
      <span className={`shrink-0 font-mono text-[10px] ${fresh ? "text-fg-subtle" : "text-fg-muted"}`}>
        {fresh ? (source.ageMs !== null ? formatAgo(source.ageMs).replace(" ago", "") : "") : source.health.toUpperCase()}
      </span>
      <span className="sr-only">{title}</span>
    </li>
  );
}
