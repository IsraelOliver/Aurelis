"use client";

import { useEffect, useId, useRef } from "react";
import { DEFAULT_THEME, THEMES, type ThemeInfo } from "@/lib/appearance";
import { useTheme } from "@/components/useTheme";

/**
 * AURELIS SETTINGS (desktop, `lg` and up): a window over the workspace — no
 * route, no panel change. THEMES: Ember (the identity, default), Atlas,
 * Basalt. A choice applies live and persists on this device. Escape, × or a
 * click outside closes it; focus is trapped while open and returns to the
 * opener. The map, selection, domain and SMILEY conversation are untouched.
 */
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    // Capture phase: Escape closes this window only, not the panel below it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")].filter(
        (el) => el.tabIndex >= 0,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus();
    };
  }, []);

  /** Arrow keys move the choice (roving focus, like native radios). */
  const onRadioKeys = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const i = THEMES.findIndex((t) => t.id === theme);
    setTheme(THEMES[(i + step + THEMES.length) % THEMES.length].id);
    const group = event.currentTarget;
    requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };

  return (
    <div
      className="fixed inset-0 z-[70] hidden items-center justify-center bg-scrim p-8 backdrop-blur-[3px] motion-safe:animate-scrim-in lg:flex"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-[760px] max-w-full flex-col overflow-hidden rounded-[22px] border border-hairline-strong bg-material-window text-fg shadow-window backdrop-blur-material backdrop-saturate-150 motion-safe:animate-window-in"
      >
        <header className="flex items-start gap-4 px-8 pb-6 pt-7">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.28em] text-fg-subtle">
              <span className="size-1.5 rotate-45 [background:var(--accent-fill)]" aria-hidden="true" />
              AURELIS SETTINGS
            </p>
            <h2 id={titleId} className="mt-2.5 font-display text-[34px] leading-none tracking-[-0.01em] text-fg">
              Appearance
            </h2>
            <p className="mt-2 text-[12.5px] text-fg-muted">How the workspace looks on this device.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            title="Close (Esc)"
            className="-mr-2 ml-auto grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors duration-150 hover:bg-material-hover hover:text-fg focus-visible:outline-accent"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <section className="min-h-0 overflow-y-auto border-t border-hairline px-8 pb-2 pt-5" aria-labelledby={`${titleId}-themes`}>
          <div className="mb-3.5 flex items-center gap-3">
            <h3 id={`${titleId}-themes`} className="text-[10.5px] font-medium tracking-[0.24em] text-fg-subtle">
              THEMES
            </h3>
            <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
          </div>
          <div role="radiogroup" aria-label="Theme" onKeyDown={onRadioKeys} className="grid grid-cols-3 gap-4">
            {THEMES.map((t) => (
              <ThemeCard key={t.id} theme={t} checked={theme === t.id} onSelect={() => setTheme(t.id)} />
            ))}
          </div>
          <p className="mt-5 text-[11.5px] leading-snug text-fg-subtle">
            Themes dress the workspace. The map, its layers and their data colors stay constant, so readings compare
            across themes.
          </p>
        </section>

        <footer className="mt-4 flex items-center gap-3 border-t border-hairline px-8 py-4">
          <p className="text-[11.5px] text-fg-subtle">Applied instantly · saved on this device · desktop only</p>
          <button
            type="button"
            onClick={() => setTheme(DEFAULT_THEME)}
            disabled={theme === DEFAULT_THEME}
            className="ml-auto h-8 shrink-0 rounded-full border border-hairline-strong px-4 text-[12px] font-medium text-fg-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40"
          >
            Reset Appearance
          </button>
        </footer>
      </div>
    </div>
  );
}

/** One theme: a miniature of the workspace in that theme (sidebar, map plate, inspector), name, concept. */
function ThemeCard({ theme, checked, onSelect }: { theme: ThemeInfo; checked: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      className={`group relative flex flex-col rounded-2xl p-2 text-left transition-[box-shadow,transform,background-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:hover:-translate-y-0.5 ${
        checked
          ? "bg-material-group shadow-[0_0_0_1.5px_var(--accent-selection)]"
          : "shadow-[0_0_0_1px_var(--material-hairline-strong)] hover:bg-material-hover hover:shadow-[0_0_0_1px_var(--border-strong),var(--elevation-float)]"
      }`}
    >
      <span
        data-theme-preview={theme.id}
        className="relative flex h-[7.25rem] gap-2 overflow-hidden rounded-xl p-2 [background:var(--shell-background)]"
        aria-hidden="true"
      >
        {/* sidebar */}
        <span className="flex w-[22%] flex-col gap-[6px] pl-0.5 pt-1">
          <span className="mb-1 flex items-center gap-[3px]">
            <span className="size-[5px] rotate-45 [background:var(--accent-fill)]" />
            <span className="h-[3px] w-3/5 rounded-full bg-fg/70" />
          </span>
          <span className="relative flex h-[9px] items-center rounded-[3px] px-[4px] [background:var(--nav-selected)]">
            <span className="absolute inset-y-[2px] left-0 w-px rounded-full [background:var(--accent-fill)]" />
            <span className="h-[3px] w-3/4 rounded-full bg-fg/80" />
          </span>
          <span className="h-[3px] w-4/5 rounded-full bg-fg-subtle/50" />
          <span className="h-[3px] w-3/5 rounded-full bg-fg-subtle/50" />
          <span className="mb-1 mt-auto flex items-center gap-[3px]">
            <span className="size-[4px] shrink-0 rounded-full bg-data" />
            <span className="h-[3px] w-3/5 rounded-full bg-fg-subtle/50" />
          </span>
        </span>
        {/* map plate: always the dark map, whatever the theme */}
        <span className="relative flex-1 overflow-hidden rounded-[7px] bg-map shadow-plate">
          <span className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--aurelis-blue),var(--aurelis-surface-elevated)_72%)] shadow-[0_0_0_1px_var(--aurelis-border-strong)]" />
          <span className="absolute left-[55%] top-[42%] size-[3px] rounded-full bg-[var(--aurelis-cyan)]" />
          <span className="absolute bottom-1.5 left-1.5 flex gap-[2px] rounded-full border border-hairline bg-material-float p-[2px]">
            <span className="h-[5px] w-3 rounded-full [background:var(--thumb-fill)]" />
            <span className="h-[5px] w-3 rounded-full" />
          </span>
        </span>
        {/* inspector */}
        <span className="flex w-[30%] flex-col gap-[6px] rounded-[7px] border border-hairline bg-material-panel p-2 shadow-panel">
          <span className="h-[5px] w-4/5 rounded-full bg-fg/75" />
          <span className="mt-0.5 h-[3px] w-full rounded-full bg-data/80" />
          <span className="h-[3px] w-3/5 rounded-full bg-fg-subtle/50" />
          <span className="h-[3px] w-4/5 rounded-full bg-fg-subtle/40" />
          <span className="mt-auto h-[8px] rounded-[3px] border border-accent/60" />
        </span>
      </span>
      <span className="mt-3 flex items-center gap-2 px-1.5">
        <span className="truncate font-display text-[22px] leading-none text-fg">{theme.name}</span>
        {theme.id === DEFAULT_THEME && (
          <span className="shrink-0 rounded-full border border-hairline-strong px-1.5 py-px text-[8.5px] font-medium tracking-[0.16em] text-fg-subtle">
            DEFAULT
          </span>
        )}
        {checked && (
          <svg className="ml-auto shrink-0 text-accent" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <span className="mt-2 px-1.5 pb-1.5 text-[11.5px] leading-snug text-fg-muted">{theme.concept}</span>
    </button>
  );
}

export function GearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
