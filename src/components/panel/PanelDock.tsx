"use client";

import { PHONE_SHEET_HEIGHT, SHEET_HEIGHT, type SheetSize } from "@/lib/sheet";

/**
 * Where the single right-hand panel lives. Desktop (`lg` and up): no box at
 * all (`display: contents`), so the panel stays the side column it always was.
 * Below `lg`: a bottom sheet over the map with three heights (collapsed /
 * medium / expanded) switched by taps — no drag physics. The panel inside
 * keeps its own header, close button and scroll; nothing is duplicated.
 * Phone (Tailwind `phone`): the same sheet is the mobile context sheet — rounded,
 * near-solid material, resting on the floating tab bar.
 */
export default function PanelDock({
  size,
  onSize,
  phoneHidden = false,
  children,
}: {
  size: SheetSize;
  onSize: (size: SheetSize) => void;
  /** Phone: the panel stays mounted but the sheet is not shown (Weather starts on the map). */
  phoneHidden?: boolean;
  children: React.ReactNode;
}) {
  const expanded = size === "expanded";
  return (
    <div
      data-sheet={size}
      style={{ "--sheet-height": SHEET_HEIGHT[size], "--sheet-height-phone": PHONE_SHEET_HEIGHT[size] } as React.CSSProperties}
      className={`${phoneHidden ? "phone:hidden " : ""}lg:contents max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:flex max-lg:h-[var(--sheet-height)] max-lg:flex-col max-lg:border-t max-lg:border-deep max-lg:bg-surface max-lg:pb-[env(safe-area-inset-bottom)] max-lg:pl-[env(safe-area-inset-left)] max-lg:pr-[env(safe-area-inset-right)] max-lg:shadow-[0_-12px_32px_rgba(4,9,27,0.55)] max-lg:transition-[height] max-lg:duration-200 phone:h-[calc(var(--sheet-height-phone)+var(--tabbar-space))] phone:overflow-hidden phone:rounded-t-[28px] phone:border-glass-line phone:bg-sheet phone:pb-[var(--tabbar-space)] phone:shadow-mobile phone:backdrop-blur-2xl phone:duration-300 phone:ease-[cubic-bezier(0.2,0.8,0.2,1)] phone:motion-safe:animate-[aurelis-screen-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] phone:motion-reduce:transition-none`}
    >
      <div className="relative flex h-8 shrink-0 items-stretch lg:hidden">
        {/* Handle: collapsed ⇄ medium (an expanded sheet steps down to medium). */}
        <button
          type="button"
          onClick={() => onSize(size === "collapsed" ? "medium" : "collapsed")}
          aria-label={size === "collapsed" ? "Show panel" : "Minimize panel"}
          aria-expanded={size !== "collapsed"}
          className="flex flex-1 items-center justify-center"
        >
          <span className="h-[3px] w-10 rounded-full bg-line-strong phone:h-[5px] phone:bg-fg-subtle/40" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onSize(expanded ? "medium" : "expanded")}
          aria-label={expanded ? "Reduce panel" : "Expand panel"}
          className="absolute right-1 top-0 grid h-11 w-11 place-items-center text-fg-subtle transition-colors hover:text-accent"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {expanded ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}
