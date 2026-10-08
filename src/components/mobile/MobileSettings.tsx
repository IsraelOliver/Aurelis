"use client";

import { MOBILE_THEMES } from "@/lib/appearance";
import { useTheme } from "@/components/useTheme";
import { useLogout } from "@/components/layout/SessionControl";
import type { GlobalHealth } from "@/types";
import type { SidebarSource } from "@/components/layout/Sidebar";
import { StatusReadout } from "./SourceStatusSheet";

const GROUP = "overflow-hidden rounded-[22px] border border-glass-line bg-material-group";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-7 px-2 text-[11px] font-medium tracking-[0.22em] text-fg-subtle">{children}</h2>;
}

function Chevron() {
  return (
    <svg className="shrink-0 text-fg-subtle" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * SETTINGS (phone): its own screen, not a modal — Appearance (the four
 * phone themes, own preference: `aurelis.mobileTheme`), Session, Sources,
 * About. Only settings that exist; near-solid surfaces for reading.
 */
export default function MobileSettings({
  health,
  sources,
  sourceCount,
  entityCount,
  onOpenSources,
}: {
  health: GlobalHealth;
  sources: SidebarSource[];
  sourceCount: number;
  entityCount: number;
  onOpenSources: () => void;
}) {
  const { theme, setTheme } = useTheme("mobile");
  const { leaving, logout } = useLogout();
  const fresh = sources.filter((s) => s.health === "fresh").length;

  return (
    <div className="aurelis-mobile-screen fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-base pb-[calc(var(--tabbar-space)+1rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(env(safe-area-inset-top)+1.5rem)] motion-safe:animate-[aurelis-screen-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] not-phone:hidden">
      <header className="px-2">
        <p className="text-[11px] font-medium tracking-[0.24em] text-fg-subtle">AURELIS</p>
        <h1 className="mt-1.5 font-display text-[36px] leading-none text-fg">Settings</h1>
      </header>

      <SectionLabel>APPEARANCE · THEME</SectionLabel>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2.5">
        {MOBILE_THEMES.map((t) => {
          const checked = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setTheme(t.id)}
              className={`flex flex-col rounded-[20px] p-1.5 text-left transition-[box-shadow,transform] duration-200 active:scale-[0.98] motion-reduce:transition-none ${
                checked ? "bg-material-group shadow-[0_0_0_1.5px_var(--accent-selection)]" : "shadow-[0_0_0_1px_var(--mobile-hairline)]"
              }`}
            >
              <span
                data-theme-preview={t.id}
                className="relative flex h-28 overflow-hidden rounded-[14px] p-1.5 [background:var(--shell-background)]"
                aria-hidden="true"
              >
                {/* A miniature of the phone shell in this theme: the dark map, header pills, tab bar. */}
                <span className="relative flex-1 overflow-hidden rounded-[10px] bg-map shadow-plate">
                  <span className="absolute left-1/2 top-[54%] size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--aurelis-blue),var(--aurelis-surface-elevated)_72%)] shadow-[0_0_0_1px_var(--aurelis-border-strong)]" />
                  <span className="absolute left-[56%] top-[48%] size-[3px] rounded-full bg-[var(--aurelis-cyan)]" />
                </span>
                <span className="absolute inset-x-2.5 top-2.5 flex items-center gap-1">
                  <span className="flex h-3.5 items-center gap-1 rounded-full border border-glass-line bg-glass px-1.5">
                    <span className="size-1 rotate-45 [background:var(--accent-fill)]" />
                    <span className="h-[2px] w-5 rounded-full bg-fg/70" />
                  </span>
                  <span className="ml-auto flex h-3.5 items-center gap-0.5 rounded-full border border-glass-line bg-glass px-1.5">
                    <span className="size-1 rounded-full bg-live" />
                    <span className="h-[2px] w-2.5 rounded-full bg-live/70" />
                  </span>
                  <span className="flex h-3.5 items-center rounded-full border border-glass-line bg-glass px-1.5">
                    <span className="h-[2px] w-3.5 rounded-full bg-accent" />
                  </span>
                </span>
                <span className="absolute inset-x-2.5 bottom-2.5 flex h-5 items-stretch gap-0.5 rounded-[8px] border border-glass-line bg-glass-strong p-[2px]">
                  <span className="grid flex-1 place-items-center rounded-[6px] shadow-thumb [background:var(--thumb-fill)]">
                    <span className="size-1.5 rounded-full bg-accent" />
                  </span>
                  <span className="grid flex-1 place-items-center">
                    <span className="size-1.5 rounded-full bg-fg-subtle/50" />
                  </span>
                  <span className="grid flex-1 place-items-center">
                    <span className="size-1.5 rounded-full bg-fg-subtle/50" />
                  </span>
                </span>
              </span>
              <span className="mt-2 flex items-center gap-1 px-1">
                <span className="truncate font-display text-[19px] leading-none text-fg">{t.name}</span>
                {checked && (
                  <svg className="ml-auto shrink-0 text-accent" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              <span className="mb-1 mt-1 line-clamp-2 px-1 text-[11px] leading-snug text-fg-muted">{t.concept}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 px-2 text-[12px] leading-snug text-fg-subtle">Applied instantly, on this device. The map keeps its own colors.</p>

      <SectionLabel>SESSION</SectionLabel>
      <div className={GROUP}>
        <div className="flex min-h-14 items-center gap-3 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-hairline-strong bg-material-field" aria-hidden="true">
            <span className="size-2 rotate-45 [background:var(--accent-fill)]" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-medium text-fg">Authorized</span>
            <span className="text-[13px] text-fg-muted">Private session</span>
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={leaving}
          className="flex min-h-12 w-full items-center gap-3 border-t border-hairline px-4 text-left text-[15px] font-medium text-accent transition-colors active:bg-material-hover disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4-4-4M14 12H4" />
          </svg>
          {leaving ? "Logging out…" : "Log out"}
        </button>
      </div>

      <SectionLabel>SOURCES</SectionLabel>
      <div className={GROUP}>
        <StatusReadout health={health} sourceCount={sourceCount} entityCount={entityCount} />
        <button
          type="button"
          onClick={onOpenSources}
          className="flex min-h-12 w-full items-center gap-3 border-t border-hairline px-4 text-left transition-colors active:bg-material-hover"
        >
          <span className="flex-1 text-[15px] text-fg">Source status</span>
          <span className="font-mono text-[12px] text-data">
            {fresh}/{sources.length} fresh
          </span>
          <Chevron />
        </button>
      </div>

      <SectionLabel>ABOUT</SectionLabel>
      <div className={GROUP}>
        <div className="px-4 py-4">
          <p className="flex items-center gap-2.5">
            <span className="size-2 rotate-45 [background:var(--accent-fill)]" aria-hidden="true" />
            <span className="text-[14px] font-semibold tracking-[0.34em] text-fg">AURELIS</span>
            <span className="ml-auto font-mono text-[12px] text-fg-muted">v1.0</span>
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
            Personal situational intelligence over public data sources. SMILEY interprets AURELIS data; it is not a source.
          </p>
        </div>
      </div>
    </div>
  );
}
