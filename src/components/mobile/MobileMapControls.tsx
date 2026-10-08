"use client";

import { useEffect, useRef, useState } from "react";
import type { UserLocationStatus } from "@/components/useUserLocation";

const GLASS = "border border-glass-line bg-glass shadow-mobile backdrop-blur-xl backdrop-saturate-150";
const STAGGER = 30;

/**
 * The phone's map controls: one button for the map view (projection and
 * basemap fold into a small menu that unfolds upward, row by row) and,
 * beside it, the round locate button. Locate shows the user's own live
 * position in its own color (--aurelis-you): tap to start (the browser asks
 * for permission) and centre; tap again to stop. After a pan, the button
 * stays lit as an outline and a tap re-centres. Tablets and desktop keep
 * their segmented controls (MapView).
 */
export default function MobileMapControls({
  viewLabel,
  projectionControl,
  basemapControl,
  locate,
}: {
  /** Current view in words, e.g. "Globe · Map". */
  viewLabel: string;
  projectionControl: React.ReactNode;
  basemapControl: React.ReactNode;
  locate: { status: UserLocationStatus; following: boolean; onPress: () => void };
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A tap anywhere else (map, tab bar, header) or Escape folds the menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // Location problems are said briefly next to the button (the state itself stays on the button).
  const [notice, setNotice] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState(locate.status);
  if (locate.status !== lastStatus) {
    setLastStatus(locate.status);
    setNotice(
      locate.status === "denied"
        ? "Location permission denied"
        : locate.status === "unavailable"
          ? "Location unavailable"
          : null,
    );
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const on = locate.status === "on";
  const locating = locate.status === "locating";
  const lit = on && locate.following;
  const locateLabel = locating
    ? "Locating… tap to cancel"
    : on
      ? locate.following
        ? "Stop showing my location"
        : "Centre on my location"
      : "Show my location";

  const rows = [
    { key: "projection", label: "PROJECTION", control: projectionControl },
    { key: "basemap", label: "BASEMAP", control: basemapControl },
  ];

  return (
    <div ref={rootRef} className="relative flex items-end gap-2 not-phone:hidden">
      <div className="relative">
        {/* Unfolds upward from the button: the row nearest the button first. */}
        <div
          id="aurelis-map-view"
          role="group"
          aria-label="Map view"
          inert={!open}
          className={`absolute bottom-[calc(100%+0.5rem)] left-0 w-max origin-bottom-left rounded-[22px] p-2 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${GLASS} ${
            open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          {rows.map((row, i) => (
            <div
              key={row.key}
              style={{ transitionDelay: open ? `${(rows.length - 1 - i) * STAGGER}ms` : "0ms" }}
              className={`flex flex-col gap-1 px-1 py-1 transition-[opacity,transform] duration-[160ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
                open ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
              }`}
            >
              <span className="px-1.5 text-[10.5px] font-medium tracking-[0.18em] text-fg-subtle">{row.label}</span>
              {row.control}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="aurelis-map-view"
          aria-label={`Map view: ${viewLabel}`}
          className={`flex h-12 items-center gap-2 rounded-full pl-3.5 pr-4 text-[12px] font-semibold tracking-[0.1em] text-fg transition-transform active:scale-[0.97] ${GLASS} ${
            open ? "ring-1 ring-accent/45" : ""
          }`}
        >
          <svg className="text-accent" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z" />
          </svg>
          <span className="whitespace-nowrap">{viewLabel.toUpperCase()}</span>
          <svg className={`text-fg-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={locate.onPress}
          aria-pressed={on}
          aria-label={locateLabel}
          title={locateLabel}
          className={`grid size-12 place-items-center rounded-full transition-[background,color,transform,box-shadow] duration-200 active:scale-[0.95] motion-reduce:transition-none ${
            lit
              ? "border border-transparent bg-you text-[var(--aurelis-text)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--aurelis-you)_28%,transparent),var(--mobile-shadow)]"
              : `${GLASS} ${on || locating ? "text-you" : "text-fg-muted"}`
          }`}
        >
          <svg className={locating ? "motion-safe:animate-pulse" : ""} viewBox="0 0 24 24" width="20" height="20" fill={lit ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.5 3.5L3.5 10.6l7 2.4 2.4 7z" />
          </svg>
        </button>
      </div>
      {notice && (
        <p
          role="status"
          className={`absolute bottom-[calc(100%+0.5rem)] left-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium text-fg motion-safe:animate-[aurelis-screen-in_200ms_cubic-bezier(0.2,0.8,0.2,1)] ${GLASS}`}
        >
          {notice}
        </p>
      )}
    </div>
  );
}
