import type { AuroraForecastFeed, PlanetaryKpFeed, SourceHealth } from "@/types";
import { EMPTY, Note, PanelShell, Row, Section, SourceLink, Time } from "./primitives";
import KpTrendChart from "./KpTrendChart";

const count = new Intl.NumberFormat("en-US");

/** Per-product source notice: two independent sources share this panel. */
function SourceNotice({ label, health, staleText }: { label: string; health: SourceHealth; staleText: string }) {
  if (health !== "stale" && health !== "unavailable") return null;
  return (
    <p role="status" className="mb-2 rounded border border-line px-3 py-2 text-[11px] leading-snug text-fg-muted">
      {label} SOURCE {health.toUpperCase()}
      {health === "stale" && <span className="block text-fg-subtle">{staleText}</span>}
    </p>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted">
      {children}
    </span>
  );
}

/**
 * SPACE domain panel: global/modeled data, no Entity. Two different products
 * with separate provenance and health: planetary Kp (ESTIMATED) and the
 * OVATION aurora forecast (FORECAST). Reads only loaded snapshots; never fetches.
 */
export default function SpaceWeatherPanel({
  kp,
  kpHealth,
  aurora,
  auroraHealth,
  auroraVisible,
  onToggleAurora,
  onClose,
}: {
  kp: PlanetaryKpFeed | null;
  kpHealth: SourceHealth;
  aurora: AuroraForecastFeed | null;
  auroraHealth: SourceHealth;
  auroraVisible: boolean;
  onToggleAurora: () => void;
  onClose: () => void;
}) {
  const latest = kp?.observations.find((o) => o.id === kp.latestObservationId) ?? null;
  const forecast = aurora?.observation ?? null;

  return (
    <PanelShell eyebrow="SPACE" title="Space Weather" onClose={onClose}>
      <Section title="PLANETARY Kp">
        <SourceNotice label="Kp" health={kpHealth} staleText="Showing the last known estimate." />
        <div className="flex items-baseline gap-3 py-1.5">
          <span className="font-mono text-[32px] leading-none text-gold">
            {latest ? String(latest.data.estimatedKp) : EMPTY}
          </span>
          <Tag>ESTIMATED</Tag>
        </div>
        <Note>Near-real-time planetary Kp estimate from NOAA SWPC.</Note>
        <Note>Kp ranges from 0 to 9 and represents planetary geomagnetic activity.</Note>
      </Section>

      {kp && kp.observations.length > 0 && (
        <Section title={`Kp TREND · LAST ${kp.metadata.windowHours} H`}>
          <KpTrendChart observations={kp.observations} windowHours={kp.metadata.windowHours} />
        </Section>
      )}

      <Section title="Kp PROVENANCE">
        <Row label="LATEST ESTIMATE">
          <Time iso={latest?.observedAt} />
          <Note>Minute the estimate applies to.</Note>
        </Row>
        <Row label="INGESTED">
          <Time iso={kp?.metadata.ingestedAt} />
        </Row>
        <Row label="SOURCE">{kp?.source.name ?? EMPTY}</Row>
        <Row label="NATURE">{latest ? latest.nature.toUpperCase() : EMPTY}</Row>
        <Row label="AURELIS CONFIDENCE">{latest ? latest.confidence.toUpperCase() : EMPTY}</Row>
      </Section>
      {kp?.source.url && <SourceLink href={kp.source.url} srText="NOAA SWPC planetary K-index" />}

      <Section title="AURORA FORECAST · 30–90 MIN">
        <SourceNotice label="AURORA" health={auroraHealth} staleText="Showing the last available forecast." />
        <div className="flex items-center gap-3 py-1.5">
          <Tag>FORECAST</Tag>
          <button
            type="button"
            onClick={onToggleAurora}
            disabled={!forecast}
            aria-pressed={auroraVisible}
            className={`ml-auto h-7 rounded border px-3 text-[10px] font-medium tracking-[0.2em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              auroraVisible
                ? "border-gold/60 text-gold hover:border-gold"
                : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            {auroraVisible ? "HIDE AURORA" : "SHOW ON MAP"}
          </button>
        </div>
        <Note>OVATION is a short-term model forecast of aurora location and intensity.</Note>
        <Note>
          Lead time is approximately 30–90 minutes and depends on solar-wind transit from L1 to Earth.
        </Note>
        <Note>Not a visibility guarantee: clouds, daylight and local conditions are not included.</Note>
        <Note>
          Map uses visual interpolation; on the globe it is slightly raised for readability (OVATION
          gives no altitude).
        </Note>
        <dl className="mt-2">
          <Row label="VALID FOR">
            <Time iso={forecast?.validAt} />
            <Note>Source “Forecast Time”.</Note>
          </Row>
          <Row label="SOURCE OBS. TIME">
            <Time iso={forecast?.data.inputObservationTime} />
            <Note>Source “Observation Time”; meaning not documented for this file. Not an observation of aurora.</Note>
          </Row>
          <Row label="GRID">
            {forecast ? (
              <>
                <span className="font-mono">
                  {count.format(forecast.data.activeGridCells)} / {count.format(forecast.data.totalGridCells)}
                </span>
                <Note>Non-zero cells / all cells, 1° grid.</Note>
              </>
            ) : (
              EMPTY
            )}
          </Row>
          <Row label="PEAK MODEL VALUE">
            {forecast ? (
              <>
                <span className="font-mono">{forecast.data.peakValue}</span>
                <Note>Raw “Aurora” grid value; unit and scale not documented by the source.</Note>
              </>
            ) : (
              EMPTY
            )}
          </Row>
          <Row label="INGESTED">
            <Time iso={aurora?.metadata.ingestedAt} />
          </Row>
          <Row label="SOURCE">{aurora?.source.name ?? EMPTY}</Row>
          <Row label="NATURE">{forecast ? forecast.nature.toUpperCase() : EMPTY}</Row>
          <Row label="AURELIS CONFIDENCE">{forecast ? forecast.confidence.toUpperCase() : EMPTY}</Row>
        </dl>
      </Section>
      {aurora?.source.url && <SourceLink href={aurora.source.url} srText="NOAA SWPC aurora 30 minute forecast" />}
    </PanelShell>
  );
}
