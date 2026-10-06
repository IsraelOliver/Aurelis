import type {
  AurelisEntity,
  EarthquakeObservation,
  IntelligenceSource,
  SourceHealth,
} from "@/types";
import {
  formatDepthKm,
  formatLatitude,
  formatLongitude,
  formatMagnitude,
} from "@/lib/format";
import { EMPTY, Note, PanelShell, Row, Section, SourceLink, Time } from "./primitives";

/**
 * Intelligence Panel for a selected earthquake. Reads only data already
 * loaded through /api/earthquakes; never fetches.
 */
export default function EarthquakePanel({
  entity,
  observation,
  source,
  sourceHealth,
  onHideEarthquakes,
  onClose,
}: {
  entity: AurelisEntity;
  observation: EarthquakeObservation;
  source: IntelligenceSource;
  sourceHealth: SourceHealth;
  /** Hides the earthquake layer (returns to the DISASTERS panel). */
  onHideEarthquakes: () => void;
  onClose: () => void;
}) {
  const { data, location } = observation;
  const magnitude = formatMagnitude(data.magnitude);
  const place = data.place ?? entity.label;

  return (
    <PanelShell
      eyebrow="EARTHQUAKE"
      title={place ?? EMPTY}
      sourceHealth={sourceHealth}
      onClose={onClose}
    >
      <div className="flex items-baseline gap-2 px-4 pb-4">
        <span className="font-mono text-[30px] leading-none text-cyan">
          {magnitude ?? EMPTY}
        </span>
        <span className="text-[10px] font-medium tracking-[0.18em] text-fg-subtle">
          MAGNITUDE{data.magnitudeType ? ` · ${data.magnitudeType}` : ""}
        </span>
        <button
          type="button"
          onClick={onHideEarthquakes}
          className="ml-auto h-7 self-center rounded border border-gold/60 px-3 text-[10px] font-medium tracking-[0.2em] text-gold transition-colors hover:border-gold"
        >
          HIDE EARTHQUAKES
        </button>
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
        <SourceLink href={observation.sourceUrl} srText="USGS event page" />
      )}
    </PanelShell>
  );
}
