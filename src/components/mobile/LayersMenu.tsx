"use client";

import { useEffect, useRef } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import type { DomainId } from "@/components/Workspace";
import CategoryIcon from "@/components/layout/CategoryIcon";

const DOMAINS = new Set<CategoryId>(["space", "disasters", "weather", "air"]);
const titleCase = (label: string) => label.charAt(0) + label.slice(1).toLowerCase();

/** Per-item stagger (ms) while the stack unfolds; closing is one quick fade. */
const STAGGER = 20;

/**
 * Layers (phone): a quick selector of the map's context, unfolding right
 * under the Layers button — one shared glass group whose rows appear top to
 * bottom (opacity + small translate + scale, 20 ms apart; ~280 ms in all). WORLD is the
 * overview (no domain panel); CYBER and SEA are listed but inert, as on
 * desktop. Choosing a domain opens its panel in the context sheet and folds
 * the stack. Floats over the map: nothing is resized or moved. Height is
 * capped between the header and the tab bar (scrolls on short landscape).
 * Inert and pointer-transparent while folded.
 */
export default function LayersMenu({
  open,
  onClose,
  activeDomain,
  counts,
  onWorld,
  onDomain,
}: {
  open: boolean;
  onClose: () => void;
  activeDomain: DomainId | null;
  counts: Partial<Record<CategoryId, string>>;
  onWorld: () => void;
  onDomain: (domain: DomainId) => void;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  return (
    <div
      id="aurelis-layers"
      role="group"
      aria-label="Domains"
      inert={!open}
      className={`absolute right-0 top-[calc(100%+0.5rem)] w-[13.5rem] origin-top-right overflow-y-auto overscroll-contain rounded-[22px] border border-glass-line bg-glass-strong p-1.5 shadow-mobile backdrop-blur-2xl backdrop-saturate-150 transition-[opacity,transform] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none max-h-[calc(100dvh-var(--tabbar-space)-env(safe-area-inset-top)-5.25rem)] ${
        open ? "pointer-events-auto scale-100 opacity-100 duration-[180ms]" : "pointer-events-none scale-95 opacity-0 duration-150"
      }`}
    >
      <ul className="flex flex-col gap-0.5">
        {CATEGORIES.map((c, i) => {
          const isDomain = DOMAINS.has(c.id);
          const enabled = isDomain || c.id === "world";
          const active = c.id === "world" ? activeDomain === null : activeDomain === c.id;
          return (
            <li
              key={c.id}
              style={{ transitionDelay: open ? `${i * STAGGER}ms` : "0ms" }}
              className={`transition-[opacity,transform] duration-[160ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
                open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.97] opacity-0"
              }`}
            >
              <button
                type="button"
                disabled={!enabled}
                aria-pressed={enabled ? active : undefined}
                onClick={() => {
                  if (c.id === "world") onWorld();
                  else if (isDomain) onDomain(c.id as DomainId);
                  onClose();
                }}
                className={`flex h-12 w-full items-center gap-3 rounded-[16px] border px-2.5 text-left transition-colors duration-150 ${
                  active
                    ? "border-accent/35 bg-material-selected"
                    : enabled
                      ? "border-transparent active:bg-material-hover"
                      : "border-transparent opacity-45"
                }`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[18px] ${
                    active ? "bg-accent/12 text-accent" : "bg-material-field text-fg-muted"
                  }`}
                >
                  <CategoryIcon id={c.id} />
                </span>
                <span className={`min-w-0 flex-1 truncate text-[15px] ${active ? "font-semibold text-fg" : "font-medium text-fg"}`}>
                  {titleCase(c.label)}
                </span>
                {!enabled && <span className="shrink-0 text-[10.5px] font-medium tracking-[0.12em] text-fg-subtle">SOON</span>}
                {enabled && counts[c.id] && !active && <span className="shrink-0 font-mono text-[12px] text-data">{counts[c.id]}</span>}
                {active && (
                  <svg className="shrink-0 text-accent" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
