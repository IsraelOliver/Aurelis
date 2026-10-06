import type { PlanetaryKpFeed, SourceHealth } from "@/types";
import { EMPTY, Note, PanelShell, Row, Section, SourceLink, Time } from "./primitives";
import KpTrendChart from "./KpTrendChart";

/**
 * SPACE domain panel: global, non-geographic data (no Entity, nothing on the
 * map). Reads only the latest /api/space/weather/kp snapshot; never fetches.
 */
export default function SpaceWeatherPanel({
  feed,
  sourceHealth,
  onClose,
}: {
  feed: PlanetaryKpFeed | null;
  sourceHealth: SourceHealth;
  onClose: () => void;
}) {
  const latest = feed?.observations.find((o) => o.id === feed.latestObservationId) ?? null;

  return (
    <PanelShell eyebrow="SPACE" title="Space Weather" sourceHealth={sourceHealth} onClose={onClose}>
      <Section title="PLANETARY Kp">
        <div className="flex items-baseline gap-3 py-1.5">
          <span className="font-mono text-[32px] leading-none text-gold">
            {latest ? String(latest.data.estimatedKp) : EMPTY}
          </span>
          <span className="rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted">
            ESTIMATED
          </span>
        </div>
        <Note>Near-real-time planetary Kp estimate from NOAA SWPC.</Note>
        <Note>Kp ranges from 0 to 9 and represents planetary geomagnetic activity.</Note>
      </Section>

      {feed && feed.observations.length > 0 && (
        <Section title={`TREND · LAST ${feed.metadata.windowHours} H`}>
          <KpTrendChart observations={feed.observations} windowHours={feed.metadata.windowHours} />
        </Section>
      )}

      <Section title="PROVENANCE">
        <Row label="LATEST ESTIMATE">
          <Time iso={latest?.observedAt} />
          <Note>Minute the estimate applies to.</Note>
        </Row>
        <Row label="INGESTED">
          <Time iso={feed?.metadata.ingestedAt} />
        </Row>
        <Row label="SOURCE">{feed?.source.provider ?? EMPTY}</Row>
        <Row label="NATURE">{latest ? latest.nature.toUpperCase() : EMPTY}</Row>
        <Row label="AURELIS CONFIDENCE">{latest ? latest.confidence.toUpperCase() : EMPTY}</Row>
      </Section>

      {feed?.source.url && (
        <SourceLink href={feed.source.url} srText="NOAA SWPC planetary K-index" />
      )}
    </PanelShell>
  );
}
