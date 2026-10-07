import type { AircraftObservation, AurelisEntity, IntelligenceSource, SourceHealth } from "@/types";
import { formatLatitude, formatLongitude } from "@/lib/format";
import { metersPerSecondToFeetPerMinute, metersPerSecondToKnots, metersToFeet } from "@/lib/air-units";
import { displayAltitude } from "@/lib/aircraft-motion";
import { AIR_VISUAL_DELAY_MS } from "@/lib/sources/opensky/source";
import { EMPTY, Note, PanelShell, Row, Section, Time } from "./primitives";
import { Tag } from "./SolarWindSections";
import { OpenSkyAttribution } from "./AirPanel";

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmt = (v: number | undefined, convert: (x: number) => number, unit: string) =>
  v === undefined ? EMPTY : `${int.format(convert(v))} ${unit}`;

const MAP_ALTITUDE_LABEL = {
  geometric: "Geometric altitude",
  barometric: "Barometric altitude (no geometric value)",
  ground: "Surface (on ground)",
  none: "Surface (no altitude reported)",
} as const;

const POSITION_SOURCE_NOTE: Record<string, string> = {
  "ADS-B": "Broadcast by the aircraft's transponder.",
  MLAT: "Computed by OpenSky from receiver timing (multilateration).",
  ASTERIX: "From an ASTERIX surveillance feed.",
  FLARM: "Broadcast by a FLARM device.",
};

/**
 * Intelligence Panel for a selected aircraft (latest OpenSky state vector of
 * the active AIR scan). Display in aeronautical units; the Observation keeps
 * the SI values. Absent fields are shown as absent, never as 0. No
 * registration, type, airline or route: the source does not provide them.
 */
export default function AircraftPanel({
  entity,
  observation,
  source,
  sourceHealth,
  onHideAircraft,
  onClose,
}: {
  entity: AurelisEntity;
  observation: AircraftObservation;
  source: IntelligenceSource;
  sourceHealth: SourceHealth;
  /** Hides the aircraft layer (returns to the AIR panel). */
  onHideAircraft: () => void;
  onClose: () => void;
}) {
  const d = observation.data;
  const status = d.onGround === undefined ? EMPTY : d.onGround ? "ON GROUND" : "AIRBORNE";

  return (
    <PanelShell eyebrow="AIRCRAFT" title={entity.label ?? d.icao24} sourceHealth={sourceHealth} onClose={onClose}>
      <div className="flex items-center gap-2 px-4 pb-4">
        <span className="font-mono text-[13px] tracking-[0.12em] text-cyan">{status}</span>
        <button
          type="button"
          onClick={onHideAircraft}
          className="ml-auto h-7 rounded border border-gold/60 px-3 text-[10px] font-medium tracking-[0.2em] text-gold transition-colors hover:border-gold"
        >
          HIDE AIRCRAFT
        </button>
      </div>

      <Section title="IDENTITY">
        <Row label="CALLSIGN">{d.callsign ?? EMPTY}</Row>
        <Row label="ICAO24">
          <span className="font-mono">{d.icao24}</span>
        </Row>
        {d.originCountry && (
          <Row label="ICAO24 COUNTRY">
            {d.originCountry}
            <Note>OpenSky &quot;origin country&quot;, inferred from the ICAO 24-bit address. Not a route or location.</Note>
          </Row>
        )}
      </Section>

      <Section title="STATE">
        <Row label="STATUS">{status}</Row>
        <Row label="BAROMETRIC ALTITUDE">
          <span className="font-mono">{fmt(d.baroAltitudeM, metersToFeet, "ft")}</span>
        </Row>
        {d.geoAltitudeM !== undefined && (
          <Row label="GEOMETRIC ALTITUDE">
            <span className="font-mono">{fmt(d.geoAltitudeM, metersToFeet, "ft")}</span>
          </Row>
        )}
        <Row label="GROUND SPEED">
          <span className="font-mono">{fmt(d.velocityMps, metersPerSecondToKnots, "kt")}</span>
        </Row>
        <Row label="TRACK">
          <span className="font-mono">{d.trueTrackDeg === undefined ? EMPTY : `${int.format(d.trueTrackDeg)}°`}</span>
          {d.trueTrackDeg !== undefined && <Note>True track, clockwise from north.</Note>}
        </Row>
        <Row label="VERTICAL RATE">
          <span className="font-mono">{fmt(d.verticalRateMps, metersPerSecondToFeetPerMinute, "ft/min")}</span>
        </Row>
        {d.squawk && (
          <Row label="SQUAWK">
            <span className="font-mono">{d.squawk}</span>
          </Row>
        )}
        <Row label="POSITION">
          {observation.location ? (
            <span className="font-mono">
              {formatLatitude(observation.location.latitude)}
              <br />
              {formatLongitude(observation.location.longitude)}
            </span>
          ) : (
            EMPTY
          )}
          <Note>Latest received position, approximate (position quality is not modelled).</Note>
        </Row>
      </Section>

      <Section title="MAP">
        <Row label="VISUAL DELAY">
          ~{Math.round(AIR_VISUAL_DELAY_MS / 1000)} s
          <Note>
            Map position is visually delayed to interpolate between received OpenSky positions; never projected ahead.
            Values in this panel are the latest received state.
          </Note>
        </Row>
        <Row label="MAP ALTITUDE">
          {MAP_ALTITUDE_LABEL[displayAltitude(d.geoAltitudeM ?? null, d.baroAltitudeM ?? null, d.onGround ?? null).source]}
          <Note>Globe only, real scale; flat map stays 2D.</Note>
        </Row>
      </Section>

      <Section title="PROVENANCE">
        <Row label="POSITION TIME">
          <Time iso={d.timePosition} />
          <Note>Last position update (OpenSky time_position).</Note>
        </Row>
        <Row label="LAST CONTACT">
          <Time iso={d.lastContact} />
          <Note>Last message of any kind from the transponder.</Note>
        </Row>
        {d.positionSource && (
          <Row label="POSITION SOURCE">
            {d.positionSource}
            <Note>{POSITION_SOURCE_NOTE[d.positionSource]}</Note>
          </Row>
        )}
        <Row label="INGESTED">
          <Time iso={observation.ingestedAt} />
        </Row>
        <Row label="SOURCE">{source.name}</Row>
        <Row label="NATURE">
          <Tag>REPORTED</Tag>
        </Row>
        <Row label="AURELIS CONFIDENCE">UNKNOWN</Row>
      </Section>
      <OpenSkyAttribution />
    </PanelShell>
  );
}
