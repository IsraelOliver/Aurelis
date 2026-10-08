"use client";

import { useCallback, useRef, useState } from "react";
import type { WeatherPointFeed } from "@/types";
import { formatLatitude, formatLongitude } from "@/lib/format";
import { WMO_WEATHER_CODES } from "@/lib/weather-codes";
import { useWeatherAnchor } from "@/components/map/point-anchor";

const n1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const n0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const GAP = 16; // marker → card
const MARGIN = 12; // card ↔ viewport edges
const CARD_W = 272;

const utcTime = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? `${new Date(iso).toISOString().slice(11, 16)} UTC` : null);

/** Bottom edge of the floating map header and top edge of the lowest map chrome (controls / tab bar). */
function freeBand() {
  const header = document.querySelector<HTMLElement>("button[aria-controls=aurelis-layers]");
  const floor = [document.querySelector<HTMLElement>(".aurelis-map-controls"), document.querySelector<HTMLElement>("nav[aria-label=AURELIS] > div")]
    .map((el) => el?.getBoundingClientRect().top)
    .filter((v): v is number => typeof v === "number" && v > 0);
  return {
    top: (header?.getBoundingClientRect().bottom ?? 56) + 8,
    bottom: (floor.length ? Math.min(...floor) : window.innerHeight - 90) - 8,
  };
}

/**
 * WEATHER on phones — the map is the input. While Weather is the domain:
 * with no point (or the card closed) a small instruction floats under the
 * header; a tap on the map picks a point (Workspace → the existing
 * Open-Meteo query) and this compact popover appears next to it — loading,
 * then data, or an error with Retry. A new tap moves the same popover.
 *
 * Placement is smart, not physical: the card sits above the point when there
 * is room, else below, else beside it; it is kept inside the band between
 * the header and the map controls and never covers the marker. It follows
 * the point while the map moves (point-anchor store) and hides while the
 * point is off screen or behind the globe. Only the card catches touches.
 * Provenance stays complete in the Weather sheet (DETAILS); the card shows
 * only the evidence nature (ESTIMATED) and the model time.
 */
export default function WeatherInspector({
  point,
  feed,
  failed,
  popoverOpen,
  onClose,
  onRetry,
  onDetails,
}: {
  point: { latitude: number; longitude: number } | null;
  /** Snapshot for `point` only (null while loading or after a failure). */
  feed: WeatherPointFeed | null;
  failed: boolean;
  popoverOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onDetails: () => void;
}) {
  const anchor = useWeatherAnchor();
  const [cardH, setCardH] = useState(0);
  // Real card height for placement (loading → data / error; compact variant). A callback ref:
  // the card unmounts while its point is off screen, and re-attaches when it comes back.
  const observerRef = useRef<ResizeObserver | null>(null);
  const cardRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver(() => setCardH(el.offsetHeight));
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  const showCard = Boolean(point && popoverOpen);

  // ── Instruction: a real state of Weather mode, not a toast.
  const banner = !showCard && (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-[25] flex justify-center px-4 not-phone:hidden">
      <p className="flex h-10 items-center gap-2.5 rounded-full border border-glass-line bg-glass-strong px-4 text-[11.5px] font-semibold tracking-[0.16em] text-fg shadow-mobile backdrop-blur-xl motion-safe:animate-[aurelis-screen-in_240ms_cubic-bezier(0.2,0.8,0.2,1)]">
        <svg className="text-data" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        </svg>
        SELECT A POINT ON THE GLOBE
      </p>
    </div>
  );

  if (!showCard || !point) return banner || null;
  if (!anchor || !anchor.visible) return null; // point off screen / behind the globe: hidden, kept

  // ── Smart placement inside the free band.
  const vw = window.innerWidth;
  const band = freeBand();
  const compact = band.bottom - band.top < 300; // short (landscape) screens: temperature + condition only
  const w = Math.min(CARD_W, vw - 2 * MARGIN);
  const h = cardH || (compact ? 128 : 236);
  let side: "above" | "below" | "left" | "right";
  let top: number;
  let left: number;
  if (anchor.y - GAP - h >= band.top) {
    side = "above";
    top = anchor.y - GAP - h;
  } else if (anchor.y + GAP + h <= band.bottom) {
    side = "below";
    top = anchor.y + GAP;
  } else {
    side = anchor.x > vw / 2 ? "left" : "right";
    top = Math.min(Math.max(anchor.y - h / 2, band.top), Math.max(band.top, band.bottom - h));
  }
  if (side === "left") left = anchor.x - GAP - w;
  else if (side === "right") left = anchor.x + GAP;
  else left = anchor.x - w / 2;
  left = Math.min(Math.max(left, MARGIN), vw - MARGIN - w);
  const pointerX = Math.min(Math.max(anchor.x - left, 22), w - 22);
  const pointerY = Math.min(Math.max(anchor.y - top, 22), h - 22);

  const c = feed?.current.data;
  const code = c?.weatherCode;
  const loading = !feed && !failed;
  const coords = `${formatLatitude(point.latitude)} · ${formatLongitude(point.longitude)}`;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Weather at the selected point"
      style={{ left, top, width: w, transformOrigin: side === "above" ? `${pointerX}px 100%` : side === "below" ? `${pointerX}px 0` : side === "left" ? `100% ${pointerY}px` : `0 ${pointerY}px` }}
      className="fixed z-[25] rounded-[22px] border border-glass-line bg-sheet text-fg shadow-mobile not-phone:hidden motion-safe:animate-[aurelis-pop-in_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
    >
      {/* Pointer toward the point (visual proximity, not a geometric tether). */}
      <span
        aria-hidden="true"
        className="absolute size-3 rotate-45 border-glass-line bg-sheet"
        style={
          side === "above"
            ? { left: pointerX - 6, bottom: -6.5, borderRightWidth: 1, borderBottomWidth: 1 }
            : side === "below"
              ? { left: pointerX - 6, top: -6.5, borderLeftWidth: 1, borderTopWidth: 1 }
              : side === "left"
                ? { top: pointerY - 6, right: -6.5, borderTopWidth: 1, borderRightWidth: 1 }
                : { top: pointerY - 6, left: -6.5, borderBottomWidth: 1, borderLeftWidth: 1 }
        }
      />
      <header className="flex items-start gap-2 pl-4 pr-1 pt-1">
        <div className="min-w-0 flex-1 pt-2.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-fg-subtle">
            <span className="size-1.5 rounded-full bg-data" aria-hidden="true" />
            WEATHER
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-fg-muted">{coords}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close weather"
          className="grid size-11 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors active:bg-material-hover"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="px-4 pb-4" aria-live="polite">
        {loading && (
          <div className="pt-2" role="status">
            <span className="sr-only">Loading weather for this point…</span>
            <span className="block h-8 w-28 animate-pulse rounded-lg bg-material-field" aria-hidden="true" />
            <span className="mt-2.5 block h-3.5 w-36 animate-pulse rounded bg-material-field" aria-hidden="true" />
            {!compact && (
              <span className="mt-4 flex flex-col gap-2.5" aria-hidden="true">
                <span className="h-3 w-full animate-pulse rounded bg-material-field" />
                <span className="h-3 w-full animate-pulse rounded bg-material-field" />
                <span className="h-3 w-2/3 animate-pulse rounded bg-material-field" />
              </span>
            )}
          </div>
        )}

        {failed && (
          <div className="pt-2" role="status">
            <p className="text-[12px] font-semibold tracking-[0.16em] text-fg">WEATHER UNAVAILABLE</p>
            <p className="mt-1 text-[14px] text-fg-muted">Could not load this point.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 h-10 rounded-full border border-hairline-strong px-4 text-[13px] font-medium text-fg transition-colors active:bg-material-hover"
            >
              Retry
            </button>
          </div>
        )}

        {feed && (
          <div className="pt-1">
            <p className="flex items-baseline gap-1.5">
              <span className="font-mono text-[34px] leading-none tracking-[-0.02em] text-data">
                {c?.temperatureC !== undefined ? n1.format(c.temperatureC) : "—"}
              </span>
              <span className="font-mono text-[15px] text-data/80">°C</span>
            </p>
            <p className="mt-1.5 text-[15px] leading-snug text-fg">
              {code !== undefined ? (WMO_WEATHER_CODES[code] ?? `WMO code ${code}`) : "Condition not reported"}
            </p>
            {!compact && (
              <dl className="mt-3 divide-y divide-hairline border-y border-hairline text-[14px]">
                {[
                  ["Feels like", c?.apparentTemperatureC !== undefined ? `${n1.format(c.apparentTemperatureC)} °C` : "—"],
                  ["Humidity", c?.relativeHumidityPercent !== undefined ? `${n0.format(c.relativeHumidityPercent)}%` : "—"],
                  [
                    "Wind",
                    c?.windSpeedKmh !== undefined
                      ? `${n1.format(c.windSpeedKmh)} km/h${c.windDirectionDegrees !== undefined ? ` · ${n0.format(c.windDirectionDegrees)}°` : ""}`
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-fg-muted">{label}</dt>
                    <dd className="font-mono text-[13px] text-fg">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full border border-hairline-strong px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-fg-muted" title="Model-derived, not a direct station observation">
                ESTIMATED
              </span>
              {utcTime(feed.current.validAt) && <span className="whitespace-nowrap font-mono text-[11px] text-fg-subtle">{utcTime(feed.current.validAt)}</span>}
              <button
                type="button"
                onClick={onDetails}
                className="-mr-2 ml-auto h-10 rounded-full px-3 text-[12px] font-semibold tracking-[0.14em] text-accent transition-colors active:bg-material-hover"
              >
                DETAILS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
