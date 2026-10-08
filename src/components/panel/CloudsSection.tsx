import type { CloudCoverFeed, SourceHealth } from "@/types";
import { GFS_REGISTRY_URL } from "@/lib/sources/noaa/gfs-source";
import { Note, Row, Section, Time } from "./primitives";
import { Tag } from "./SolarWindSections";

/**
 * CLOUDS (WEATHER panel): the optional global GFS model cloud cover layer.
 * Independent of the weather point. Always labelled as model output
 * (FORECAST or ESTIMATED from the observation itself), never as observed.
 */
export default function CloudsSection({
  visible,
  feed,
  health,
  failed,
  onToggle,
}: {
  visible: boolean;
  /** Field currently on the map (kept while hidden), or null before the first load. */
  feed: CloudCoverFeed | null;
  health: SourceHealth;
  /** Last attempt failed. */
  failed: boolean;
  onToggle: () => void;
}) {
  const o = feed?.observation;
  const step = o?.data.forecastHour;
  return (
    <Section title="CLOUDS">
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[10px] tracking-[0.18em] text-fg-muted">GLOBAL MODEL CLOUD COVER</span>
        {o && <Tag>{o.nature === "forecast" ? "FORECAST" : "ESTIMATED"}</Tag>}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={visible}
          className={`ml-auto h-7 shrink-0 rounded border px-3 text-[10px] font-medium tracking-[0.2em] transition-colors ${
            visible
              ? "border-accent/60 text-accent hover:border-accent"
              : "border-line-strong text-fg-muted hover:border-fg-subtle hover:text-fg"
          }`}
        >
          {visible ? "HIDE CLOUDS" : "SHOW ON MAP"}
        </button>
      </div>
      <Note>Global total cloud cover from the GFS weather model (not satellite imagery).</Note>

      {visible && !feed && !failed && <Note>Loading the latest GFS field…</Note>}
      {!feed && failed && (
        <p role="status" className="mt-2 rounded border border-line px-3 py-2 text-[11px] text-fg-muted">
          CLOUD SOURCE UNAVAILABLE · no GFS field could be loaded. Nothing is drawn.
        </p>
      )}

      {o && (
        <dl className="mt-1">
          <Row label="VALID FOR">
            <Time iso={o.validAt} />
          </Row>
          <Row label="MODEL RUN">
            <Time iso={o.data.runTime} />
          </Row>
          <Row label="FORECAST STEP">
            <span className="font-mono">{step === 0 ? "+0 H (initial state)" : `+${step} H`}</span>
          </Row>
          <Row label="RESOLUTION">0.25° · smoothed on the map</Row>
          <Row label="SOURCE">
            <a
              href={GFS_REGISTRY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-line-strong underline-offset-2 hover:text-fg"
            >
              NOAA GFS
            </a>{" "}
            · NCEP
          </Row>
        </dl>
      )}
      {feed && failed && <Note>Latest refresh failed; the previous field stays on the map.</Note>}
      {feed && !failed && health === "stale" && <Note>SOURCE STALE · this field is more than 90 min from now.</Note>}
      {feed && !visible && <Note>Hidden; the last field is kept for this session.</Note>}
    </Section>
  );
}
