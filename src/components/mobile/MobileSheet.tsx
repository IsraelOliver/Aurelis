"use client";

import { useEffect, useRef } from "react";

/**
 * A temporary phone sheet (Domains, Sources): rises from the bottom over a
 * scrim and above the tab bar; one at a time (the shell keeps a single
 * `sheet` state, so opening one replaces the other). Always mounted and inert
 * while closed, so it animates both ways and never remounts its content.
 * Near-solid material: these sheets are for reading. Escape, the handle, ×
 * or the scrim close it; focus moves in on open and back on close.
 */
export default function MobileSheet({
  open,
  onClose,
  eyebrow,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className="not-phone:hidden" inert={!open}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[70] bg-scrim transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-x-0 bottom-0 z-[71] flex max-h-[min(82dvh,calc(100dvh-env(safe-area-inset-top)-2.5rem))] flex-col rounded-t-[30px] border-t border-glass-line bg-sheet pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-mobile backdrop-blur-2xl backdrop-saturate-150 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="flex h-6 shrink-0 items-end justify-center" tabIndex={-1}>
          <span className="h-[5px] w-10 rounded-full bg-fg-subtle/40" aria-hidden="true" />
        </button>
        <header className="flex shrink-0 items-start gap-3 px-6 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium tracking-[0.22em] text-fg-subtle">{eyebrow}</p>
            <h2 className="mt-1.5 font-display text-[28px] leading-none text-fg">{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full bg-material-field text-fg-muted transition-colors active:bg-material-hover"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-2">{children}</div>
      </section>
    </div>
  );
}
