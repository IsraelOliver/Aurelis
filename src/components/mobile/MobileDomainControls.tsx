"use client";

import type { DomainId } from "@/components/Workspace";

/**
 * Domain-specific map controls (phone): a control that only makes sense in
 * one domain lives on the map while that domain is active, in the same row as
 * the global map controls (projection and basemap on the left; zoom moves up
 * on the right to make room — see globals.css `data-domain-controls`).
 * Weather → Clouds (the existing NOAA GFS cloud cover layer: same toggle,
 * same data; only the place to reach it changes on phones).
 */
export default function MobileDomainControls({
  domain,
  clouds,
}: {
  domain: DomainId;
  clouds: { on: boolean; onToggle: () => void };
}) {
  if (domain !== "weather") return null;
  return (
    <div className="absolute z-10 not-phone:hidden phone:bottom-[calc(var(--sheet-offset-phone,0px)+var(--attrib-h,1.25rem)+0.5rem)] phone:right-[max(0.75rem,env(safe-area-inset-right))] motion-safe:animate-[aurelis-screen-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]">
      <button
        type="button"
        onClick={clouds.onToggle}
        aria-pressed={clouds.on}
        aria-label={clouds.on ? "Hide cloud cover" : "Show cloud cover"}
        title="Cloud cover (NOAA GFS)"
        className={`flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border px-3.5 shadow-mobile backdrop-blur-xl backdrop-saturate-150 transition-[background,color,border-color,transform] duration-200 active:scale-[0.97] motion-reduce:transition-none ${
          clouds.on
            ? "border-accent/45 bg-glass-strong text-fg [background-image:linear-gradient(var(--material-selected),var(--material-selected))]"
            : "border-glass-line bg-glass text-fg-muted"
        }`}
      >
        <svg className={clouds.on ? "text-accent" : ""} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 18.5h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.6 4.5 4.5 0 0 0 7 18.5z" />
        </svg>
        <span className="hidden text-[12px] font-semibold tracking-[0.12em] min-[420px]:inline">CLOUDS</span>
      </button>
    </div>
  );
}
