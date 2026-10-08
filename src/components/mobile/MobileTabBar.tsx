"use client";

export type MobileTab = "map" | "smiley" | "settings";

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "map",
    label: "Map",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z" />
      </svg>
    ),
  },
  {
    id: "smiley",
    label: "Smiley",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.2l8.8 8.8-8.8 8.8L3.2 12z" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2.2" />
        <circle cx="8" cy="17" r="2.2" />
      </svg>
    ),
  },
];

/**
 * The phone's top-level navigation: MAP · SMILEY · SETTINGS. A floating
 * material bar above the home area; every tab is a real destination, the map
 * never unmounts behind them. Steps aside while the keyboard is up
 * (`data-keyboard`, see SmileyDock).
 */
export default function MobileTabBar({ tab, onTab }: { tab: MobileTab; onTab: (tab: MobileTab) => void }) {
  return (
    <nav
      aria-label="AURELIS"
      className="aurelis-tabbar pointer-events-none fixed inset-x-0 bottom-0 z-[60] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] not-phone:hidden"
    >
      <div className="pointer-events-auto mx-auto flex h-16 max-w-md items-stretch gap-1 rounded-[26px] border border-glass-line bg-glass-strong p-1.5 shadow-mobile backdrop-blur-2xl backdrop-saturate-150">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] transition-[background,color,transform] duration-200 active:scale-[0.97] motion-reduce:transition-none ${
                active ? "text-fg shadow-thumb [background:var(--thumb-fill)]" : "text-fg-muted"
              }`}
            >
              <span className={active ? "text-accent" : ""}>{t.icon}</span>
              <span className={`text-[11px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
