import type {
  AurelisEntity,
  EarthquakeObservation,
  IntelligenceSource,
} from "@/types";
import {
  formatDepthKm,
  formatLatitude,
  formatLongitude,
  formatMagnitude,
  formatUtc,
} from "@/lib/format";

const EMPTY = "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5">
      <dt className="pt-px text-[10px] font-medium tracking-[0.18em] text-fg-subtle">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[12px] text-fg">{children}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <span className="mt-0.5 block text-[11px] leading-snug text-fg-subtle">{children}</span>;
}

function Time({ iso }: { iso: string | undefined }) {
  const t = formatUtc(iso);
  if (!t) return <>{EMPTY}</>;
  return (
    <span className="font-mono">
      {t.date}
      <br />
      {t.time}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3">
      <h3 className="mb-1 text-[10px] font-medium tracking-[0.28em] text-fg-subtle">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

/**
 * Fixed right-hand panel for the selected entity. Reads only data already
 * loaded through /api/earthquakes; never fetches.
 */
export default function IntelligencePanel({
  entity,
  observation,
  source,
  onClose,
}: {
  entity: AurelisEntity;
  observation: EarthquakeObservation;
  source: IntelligenceSource;
  onClose: () => void;
}) {
  const { data, location } = observation;
  const magnitude = formatMagnitude(data.magnitude);
  const place = data.place ?? entity.label;

  return (
    <aside
      aria-label="Intelligence panel"
      className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface"
    >
      <header className="flex items-start gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.28em] text-fg-subtle">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
            EARTHQUAKE
          </p>
          <h2 className="mt-1.5 text-[15px] font-medium leading-snug text-fg">
            {place ?? EMPTY}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close intelligence panel"
          className="-mr-1 grid size-7 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-elevated hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex items-baseline gap-2 px-4 pb-4">
        <span className="font-mono text-[30px] leading-none text-cyan">
          {magnitude ?? EMPTY}
        </span>
        <span className="text-[10px] font-medium tracking-[0.18em] text-fg-subtle">
          MAGNITUDE{data.magnitudeType ? ` · ${data.magnitudeType}` : ""}
        </span>
      </div>

      <Section title="EVENT">
        <Row label="MAGNITUDE">
          <span className="font-mono">{magnitude ?? EMPTY}</span>
          {data.magnitudeType && <Note>Type {data.magnitudeType}</Note>}
        </Row>
        <Row label="DEPTH">
          <span className="font-mono">{formatDepthKm(data.depthKm)}</span>
        </Row>
        <Row label="LOCATION">{place ?? EMPTY}</Row>
        <Row label="COORDINATES">
          {location ? (
            <span className="font-mono">
              {formatLatitude(location.latitude)}
              <br />
              {formatLongitude(location.longitude)}
            </span>
          ) : (
            EMPTY
          )}
        </Row>
        <Row label="LOCATION PRECISION">
          {location ? location.precision.toUpperCase() : EMPTY}
          {location?.precision === "approximate" && (
            <Note>Computed from seismic data; not an exact position.</Note>
          )}
        </Row>
        <Row label="EVENT TIME">
          <Time iso={observation.observedAt} />
        </Row>
        <Row label="USGS UPDATED">
          <Time iso={observation.reportedAt} />
          <Note>Latest update of this USGS record.</Note>
        </Row>
        <Row label="STATUS">{data.status?.toUpperCase() ?? EMPTY}</Row>
        <Row label="TSUNAMI FLAG">
          {data.tsunamiFlag === undefined ? EMPTY : data.tsunamiFlag ? "YES" : "NO"}
          {data.tsunamiFlag && (
            <Note>Flag for large oceanic events; does not mean a tsunami exists.</Note>
          )}
        </Row>
        <Row label="ALERT">
          {data.alert?.toUpperCase() ?? EMPTY}
          {data.alert === null && <Note>No PAGER alert level in the feed.</Note>}
        </Row>
        <Row label="NETWORK">{data.preferredNetwork?.toUpperCase() ?? EMPTY}</Row>
      </Section>

      <Section title="PROVENANCE">
        <Row label="SOURCE">
          {source.provider ?? source.name}
          <Note>{source.name}</Note>
        </Row>
        <Row label="NATURE">
          {observation.nature.toUpperCase()}
          {observation.nature === "reported" && (
            <Note>Stated by the source; not observed by AURELIS.</Note>
          )}
        </Row>
        <Row label="AURELIS CONFIDENCE">
          {observation.confidence.toUpperCase()}
          {observation.confidence === "unknown" && (
            <Note>AURELIS has no confidence methodology yet.</Note>
          )}
        </Row>
        <Row label="SOURCE RECORD">
          <span className="font-mono">{observation.sourceRecordId ?? EMPTY}</span>
        </Row>
        <Row label="INGESTED">
          <Time iso={observation.ingestedAt} />
          <Note>Received by the AURELIS server.</Note>
        </Row>
      </Section>

      {observation.sourceUrl && (
        <div className="border-t border-line px-4 py-4">
          <a
            href={observation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center justify-center gap-2 rounded border border-line text-[10px] font-medium tracking-[0.2em] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            OPEN ORIGINAL SOURCE
            <span className="sr-only">(USGS event page, opens in a new tab)</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
        </div>
      )}
    </aside>
  );
}
