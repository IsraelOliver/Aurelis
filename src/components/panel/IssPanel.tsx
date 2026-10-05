import { useState } from "react";
import type {
  AurelisEntity,
  IntelligenceSource,
  IssObservation,
  SourceHealth,
} from "@/types";
import { formatLatitude, formatLongitude } from "@/lib/format";
import { NASA_ISS_STREAM } from "@/lib/sources/nasa/iss-media";
import IssCamera from "./IssCamera";
import { EMPTY, Note, PanelShell, Row, Section, SourceLink, Time } from "./primitives";

const km = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * Intelligence Panel for the ISS. Reads only the latest snapshot already
 * loaded through /api/space/iss; never fetches. Updates with each new position.
 * Mounted per selection (keyed by entity id), so the camera always starts
 * closed and its iframe disappears when the panel unmounts.
 */
export default function IssPanel({
  entity,
  observation,
  source,
  sourceHealth,
  onClose,
}: {
  entity: AurelisEntity;
  observation: IssObservation;
  source: IntelligenceSource;
  sourceHealth: SourceHealth;
  onClose: () => void;
}) {
  const { data, location } = observation;
  // Camera state is independent of telemetry health: a stale WTIA source does not hide it.
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <PanelShell
      eyebrow="SPACE OBJECT"
      title={entity.label ?? EMPTY}
      sourceHealth={sourceHealth}
      onClose={onClose}
      wide={cameraOpen}
    >
      <Section title="POSITION">
        <Row label="NORAD">
          <span className="font-mono">{data.noradId}</span>
        </Row>
        <Row label="POSITION">
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
            <Note>Computed from orbital data; not a direct GPS fix.</Note>
          )}
        </Row>
        <Row label="ALTITUDE">
          <span className="font-mono">{km.format(data.altitudeKm)} km</span>
        </Row>
        <Row label="VELOCITY">
          {/* The raw value stays in the Observation; without a documented unit it is not a usable metric. */}
          {data.velocityUnit === "unknown" ? (
            <>
              {EMPTY}
              <Note>Unit not documented by source.</Note>
            </>
          ) : (
            <span className="font-mono">{data.velocity}</span>
          )}
        </Row>
        <Row label="VISIBILITY">{data.visibility?.toUpperCase() ?? EMPTY}</Row>
        <Row label="OBSERVED">
          <Time iso={observation.observedAt} />
          <Note>Instant the computed position applies to.</Note>
        </Row>
      </Section>

      <IssCamera media={NASA_ISS_STREAM} open={cameraOpen} onOpenChange={setCameraOpen} />

      <Section title="PROVENANCE">
        <Row label="SOURCE">{source.provider ?? source.name}</Row>
        <Row label="NATURE">
          {observation.nature.toUpperCase()}
          {observation.nature === "estimated" && (
            <Note>Orbital estimate by the source; not observed by AURELIS.</Note>
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
        <SourceLink
          href={observation.sourceUrl}
          srText="Where The ISS At? API record for this timestamp"
        />
      )}
    </PanelShell>
  );
}
