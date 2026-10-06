import type { AurelisEntity, EonetEventObservation, IntelligenceSource, SourceHealth } from "@/types";
import { formatLatitude, formatLongitude } from "@/lib/format";
import { EMPTY, Note, PanelShell, Row, Section, SourceLink, Time } from "./primitives";

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * Panel for one NASA EONET natural event (Entity disaster:eonet:<id>). Reads
 * only the loaded snapshot; never fetches. Shows the latest geometry and its
 * source time as published, with EONET's precision caveat.
 */
export default function EonetEventPanel({
  entity,
  observation,
  source,
  sourceHealth,
  onHideEonet,
  onClose,
}: {
  entity: AurelisEntity;
  observation: EonetEventObservation;
  source: IntelligenceSource;
  sourceHealth: SourceHealth;
  /** Hides the EONET map layers (returns to the DISASTERS panel). */
  onHideEonet: () => void;
  onClose: () => void;
}) {
  const d = observation.data;
  const g = d.geometries[d.latestGeometryIndex];

  return (
    <PanelShell eyebrow="NATURAL EVENT" title={entity.label ?? d.title} sourceHealth={sourceHealth} onClose={onClose}>
      <Section title="EVENT">
        <div className="py-1.5">
          <div className="flex items-center">
            <span className="rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted">
              OPEN IN EONET
            </span>
            <button
              type="button"
              onClick={onHideEonet}
              className="ml-auto h-7 rounded border border-gold/60 px-3 text-[10px] font-medium tracking-[0.2em] text-gold transition-colors hover:border-gold"
            >
              HIDE EONET
            </button>
          </div>
          <Note>Open in EONET (no closing date yet); not a guarantee that it is occurring now.</Note>
        </div>
        <Row label="CATEGORIES">{d.categories.map((c) => c.title).join(", ") || EMPTY}</Row>
        {d.description && <Row label="DESCRIPTION">{d.description}</Row>}
      </Section>

      <Section title="LATEST GEOMETRY">
        <Row label="TYPE">{g.type.toUpperCase()}</Row>
        {g.type === "Point" && entity.location ? (
          <Row label="POSITION">
            <span className="font-mono">
              {formatLatitude(entity.location.latitude)}
              <br />
              {formatLongitude(entity.location.longitude)}
            </span>
            <Note>APPROXIMATE</Note>
          </Row>
        ) : (
          <Row label="AREA">
            Polygon as published
            <Note>No centroid computed.</Note>
          </Row>
        )}
        <Row label="SOURCE GEOMETRY TIME">
          <Time iso={g.date} />
          <Note>Often 00:00Z when the source gave no time; not an observation time.</Note>
        </Row>
        {g.magnitudeValue !== undefined && (
          <Row label="MAGNITUDE">
            <span className="font-mono">
              {num.format(g.magnitudeValue)}
              {g.magnitudeUnit ? ` ${g.magnitudeUnit}` : ""}
            </span>
            {g.magnitudeDescription && <Note>{g.magnitudeDescription}</Note>}
          </Row>
        )}
        <Row label="GEOMETRIES">
          <span className="font-mono">{d.geometries.length}</span>
          <Note>Received for this event; only the latest is drawn.</Note>
        </Row>
        <Note>EONET spatial and temporal extents may be approximate.</Note>
      </Section>

      {d.upstreamSources.length > 0 && (
        <Section title="EVENT SOURCES">
          <ul className="flex flex-col gap-1.5 py-1">
            {d.upstreamSources.map((s) => (
              <li key={`${s.id}:${s.url}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-fg-muted underline decoration-line-strong underline-offset-2 hover:text-fg"
                >
                  {s.id}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <Note>Upstream sources referenced by EONET; not AURELIS sources.</Note>
        </Section>
      )}

      <Section title="PROVENANCE">
        <Row label="EONET ID">
          <span className="font-mono">{observation.sourceRecordId ?? EMPTY}</span>
        </Row>
        <Row label="INGESTED">
          <Time iso={observation.ingestedAt} />
        </Row>
        <Row label="SOURCE">{source.name}</Row>
        <Row label="NATURE">{observation.nature.toUpperCase()}</Row>
        <Row label="AURELIS CONFIDENCE">{observation.confidence.toUpperCase()}</Row>
      </Section>

      {observation.sourceUrl && <SourceLink href={observation.sourceUrl} srText="NASA EONET event" />}
    </PanelShell>
  );
}
