import type { AirTrafficFeed, SourceHealth } from "@/types";
import { AIR_POLL_MS, AIR_VISUAL_DELAY_MS, OPENSKY_API_DOCS_URL } from "@/lib/sources/opensky/source";
import { Note, PanelShell, Row, Section, Time } from "./primitives";
import { Tag } from "./SolarWindSections";

const n0 = new Intl.NumberFormat("en-US");

/** OpenSky attribution, shown next to the data (non-commercial use, REST API terms). */
export function OpenSkyAttribution() {
  return (
    <div className="border-t border-line px-4 py-3 text-[11px] text-fg-subtle">
      Aircraft data:{" "}
      <a
        href="https://opensky-network.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-fg-muted underline decoration-line-strong underline-offset-2 hover:text-fg"
      >
        The OpenSky Network
      </a>{" "}
      ·{" "}
      <a href={OPENSKY_API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-fg-muted">
        REST API
      </a>
      <span className="mt-0.5 block">Personal, non-commercial use.</span>
    </div>
  );
}

/**
 * AIR domain panel: the global OpenSky snapshot (one /states/all request).
 * Refreshed only while AIR is active and aircraft are shown.
 */
export default function AirPanel({
  feed,
  health,
  failed,
  refreshing,
  aircraftVisible,
  quotaLow,
  onToggleAircraft,
  onRefreshOnce,
  onClose,
}: {
  feed: AirTrafficFeed | null;
  health: SourceHealth;
  failed: boolean;
  /** Showing a cached snapshot while the first refresh of this activation runs. */
  refreshing: boolean;
  aircraftVisible: boolean;
  quotaLow: boolean;
  onToggleAircraft: () => void;
  onRefreshOnce: () => void;
  onClose: () => void;
}) {
  const m = feed?.metadata;
  return (
    <PanelShell eyebrow="AIR" title="Air traffic" sourceHealth={feed && aircraftVisible ? health : undefined} onClose={onClose}>
      <Section title="GLOBAL COVERAGE">
        <div className="flex items-baseline gap-2 py-1.5">
          <span className="font-mono text-[26px] leading-none text-data">{feed ? n0.format(feed.aircraft.length) : "—"}</span>
          <span className="text-[10px] tracking-[0.18em] text-fg-subtle">AIRCRAFT WITH POSITION</span>
          <button
            type="button"
            onClick={onToggleAircraft}
            aria-pressed={aircraftVisible}
            className={`ml-auto h-7 shrink-0 rounded border px-3 text-[10px] font-medium tracking-[0.2em] transition-colors ${
              aircraftVisible
                ? "border-accent/60 text-accent hover:border-accent"
                : "border-line-strong text-fg-muted hover:border-fg-subtle hover:text-fg"
            }`}
          >
            {aircraftVisible ? "HIDE AIRCRAFT" : "SHOW AIRCRAFT"}
          </button>
        </div>
        <Note>OpenSky state vectors, one global request. Coverage depends on the OpenSky receiver network and aircraft transmissions.</Note>
        {!feed && !failed && <Note>Loading the global OpenSky snapshot…</Note>}
        {!feed && failed && (
          <p role="status" className="mt-2 rounded border border-line px-3 py-2 text-[11px] text-fg-muted">
            AIR SOURCE UNAVAILABLE · no OpenSky snapshot could be loaded.
          </p>
        )}
        {feed && refreshing && <Note>Showing the previous snapshot while refreshing…</Note>}
        {!aircraftVisible && feed && <Note>Aircraft hidden: refresh paused (no credits spent).</Note>}
        {quotaLow && (
          <div role="status" className="mt-2 rounded border border-accent/40 px-3 py-2 text-[11px] text-fg-muted">
            <span className="text-accent">OPEN SKY QUOTA LOW</span> · Automatic refresh paused.
            <button
              type="button"
              onClick={onRefreshOnce}
              className="ml-2 underline decoration-line-strong underline-offset-2 hover:text-fg"
            >
              Refresh once
            </button>
          </div>
        )}
      </Section>

      {feed && m && (
        <Section title="SNAPSHOT">
          <dl>
            <Row label="TOTAL STATES">
              {n0.format(m.totalStates)}
              <Note>
                Not drawn: {n0.format(m.withoutPosition)} without a position, {n0.format(m.stalePosition)} with a position older
                than {m.maxPositionAgeS} s.
              </Note>
            </Row>
            <Row label="LAST SNAPSHOT">
              <Time iso={m.stateTime} />
            </Row>
            <Row label="REFRESH">
              {AIR_POLL_MS / 1000} s while AIR is active
              <Note>Paused in other panels and while aircraft are hidden.</Note>
            </Row>
            <Row label="VISUAL DELAY">
              ~{Math.round(AIR_VISUAL_DELAY_MS / 1000)} s
              <Note>Map positions are drawn behind time and interpolated between received positions; never projected ahead.</Note>
            </Row>
            <Row label="COST">
              {m.creditsPerRequest} credits / refresh
              {m.observedCreditsPerRequest !== null && m.observedCreditsPerRequest !== m.creditsPerRequest && (
                <Note>Observed between the last two requests: {m.observedCreditsPerRequest}.</Note>
              )}
            </Row>
            <Row label="CREDITS">{m.creditsRemaining !== null ? `${n0.format(m.creditsRemaining)} remaining` : "—"}</Row>
            <Row label="SOURCE">{feed.source.name}</Row>
            <Row label="NATURE">
              <Tag>REPORTED</Tag>
            </Row>
            <Row label="AURELIS CONFIDENCE">UNKNOWN</Row>
          </dl>
        </Section>
      )}
      <OpenSkyAttribution />
    </PanelShell>
  );
}
