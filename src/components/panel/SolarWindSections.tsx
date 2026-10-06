import type {
  InterplanetaryMagneticFieldFeed,
  SolarWindPlasmaFeed,
  SourceHealth,
} from "@/types";
import { bzOrientation } from "@/lib/solar-wind";
import { EMPTY, Note, Row, Section, Time } from "./primitives";
import SeriesChart, { type SeriesPoint } from "./SeriesChart";

const fmt = (digits: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits });
const n0 = fmt(0);
const n1 = fmt(1);
const n2 = fmt(2);

/** Per-feed notice: each RTSW feed has its own health. */
export function FeedNotice({ label, health }: { label: string; health: SourceHealth }) {
  if (health !== "stale" && health !== "unavailable") return null;
  return (
    <p role="status" className="mb-2 rounded border border-line px-3 py-2 text-[11px] leading-snug text-fg-muted">
      {label} SOURCE {health.toUpperCase()}
      {health === "stale" && <span className="block text-fg-subtle">Showing the last available measurements.</span>}
    </p>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-line px-1.5 py-0.5 text-[9.5px] font-medium tracking-[0.2em] text-fg-muted">
      {children}
    </span>
  );
}

function Provenance({ observedAt, ingestedAt, spacecraft, sourceName }: {
  observedAt?: string;
  ingestedAt?: string;
  spacecraft?: string;
  sourceName?: string;
}) {
  return (
    <dl className="mt-2">
      <Row label="SPACECRAFT">
        <span className="font-mono">{spacecraft ?? EMPTY}</span>
        <Note>Active spacecraft for this feed (SWPC can switch it).</Note>
      </Row>
      <Row label="MEASURED">
        <Time iso={observedAt} />
      </Row>
      <Row label="INGESTED">
        <Time iso={ingestedAt} />
      </Row>
      <Row label="SOURCE">{sourceName ?? EMPTY}</Row>
      <Row label="NATURE">{observedAt ? "OBSERVED" : EMPTY}</Row>
      <Row label="AURELIS CONFIDENCE">{observedAt ? "UNKNOWN" : EMPTY}</Row>
    </dl>
  );
}

/** Distinct spacecraft in the series, oldest first (several when SWPC switched the active one). */
const spacecraftIn = (points: SeriesPoint[]) => [...new Set(points.map((p) => p.group))].join(", ");

export function SolarWindSection({ feed, health }: { feed: SolarWindPlasmaFeed | null; health: SourceHealth }) {
  const latest = feed?.observations.find((o) => o.id === feed.latestObservationId) ?? null;
  const d = latest?.data;
  const speed: SeriesPoint[] = (feed?.observations ?? []).flatMap((o) =>
    o.data.protonSpeedKms === undefined
      ? []
      : [{ t: Date.parse(o.observedAt!), v: o.data.protonSpeedKms, group: o.data.spacecraft }],
  );
  const lo = speed.length ? Math.floor(Math.min(...speed.map((p) => p.v)) / 100) * 100 : 0;
  const hi = speed.length ? Math.ceil(Math.max(...speed.map((p) => p.v)) / 100) * 100 : 100;
  const ticks = [lo, Math.round((lo + hi) / 2), hi === lo ? lo + 100 : hi];

  return (
    <Section title="SOLAR WIND · PLASMA">
      <FeedNotice label="PLASMA" health={health} />
      <div className="flex items-baseline gap-2 py-1.5">
        <span className="font-mono text-[26px] leading-none text-gold">
          {d?.protonSpeedKms !== undefined ? n0.format(d.protonSpeedKms) : EMPTY}
        </span>
        <span className="text-[11px] text-fg-muted">km/s</span>
        <span className="ml-auto">
          <Tag>OBSERVED</Tag>
        </span>
      </div>
      <Note>Solar wind speed (protons). In situ measurement.</Note>
      <Note>Measurements are taken upstream of Earth, typically near the Sun–Earth L1 point.</Note>
      <dl className="mt-1">
        <Row label="PROTON DENSITY">
          {d?.protonDensityPerCm3 !== undefined ? (
            <span className="font-mono">{n2.format(d.protonDensityPerCm3)} p/cm³</span>
          ) : (
            EMPTY
          )}
        </Row>
        <Row label="PROTON TEMP.">
          {d?.protonTemperatureK !== undefined ? (
            <span className="font-mono text-fg-muted">{n0.format(d.protonTemperatureK)} K</span>
          ) : (
            EMPTY
          )}
        </Row>
      </dl>
      {speed.length > 0 && feed && (
        <figure className="mt-2">
          <SeriesChart
            points={speed}
            windowHours={feed.metadata.windowHours}
            yMin={ticks[0]}
            yMax={ticks[2]}
            yTicks={ticks}
            ariaLabel={`Solar wind speed over the last ${feed.metadata.windowHours} hours in km/s; latest ${speed.at(-1)!.v}.`}
          />
          <figcaption className="mt-1 text-[11px] leading-snug text-fg-subtle">
            Speed, km/s · last {feed.metadata.windowHours} h, 1-minute samples, UTC · {spacecraftIn(speed)}
          </figcaption>
        </figure>
      )}
      <Provenance
        observedAt={latest?.observedAt}
        ingestedAt={feed?.metadata.ingestedAt}
        spacecraft={d?.spacecraft}
        sourceName={feed?.source.name}
      />
    </Section>
  );
}

export function ImfSection({ feed, health }: { feed: InterplanetaryMagneticFieldFeed | null; health: SourceHealth }) {
  const latest = feed?.observations.find((o) => o.id === feed.latestObservationId) ?? null;
  const d = latest?.data;
  const bz: SeriesPoint[] = (feed?.observations ?? []).flatMap((o) =>
    o.data.bzGsmNt === undefined ? [] : [{ t: Date.parse(o.observedAt!), v: o.data.bzGsmNt, group: o.data.spacecraft }],
  );
  // Symmetric around 0 so north/south read the same way.
  const span = Math.max(5, Math.ceil(Math.max(0, ...bz.map((p) => Math.abs(p.v))) / 5) * 5);

  return (
    <Section title="INTERPLANETARY MAGNETIC FIELD">
      <FeedNotice label="MAG" health={health} />
      <div className="flex items-baseline gap-2 py-1.5">
        <span className="text-[10px] font-medium tracking-[0.18em] text-fg-subtle">IMF Bz</span>
        <span className="font-mono text-[26px] leading-none text-gold">
          {d?.bzGsmNt !== undefined ? n2.format(d.bzGsmNt) : EMPTY}
        </span>
        <span className="text-[11px] text-fg-muted">nT</span>
        {d?.bzGsmNt !== undefined && (
          <span className="ml-auto">
            <Tag>{bzOrientation(d.bzGsmNt)}</Tag>
          </span>
        )}
      </div>
      <Note>Bz: north/south orientation of the interplanetary magnetic field (GSM).</Note>
      <Note>
        Southward Bz can couple more effectively with Earth&apos;s magnetic field and favor stronger
        geomagnetic responses.
      </Note>
      <dl className="mt-1">
        <Row label="IMF Bt">
          {d?.btNt !== undefined ? (
            <>
              <span className="font-mono">{n2.format(d.btNt)} nT</span>
              <Note>Total IMF magnitude.</Note>
            </>
          ) : (
            EMPTY
          )}
        </Row>
      </dl>
      {bz.length > 0 && feed && (
        <figure className="mt-2">
          <SeriesChart
            points={bz}
            windowHours={feed.metadata.windowHours}
            yMin={-span}
            yMax={span}
            yTicks={[-span, 0, span]}
            zeroLine
            zeroLabels={{ above: "NORTH", below: "SOUTH" }}
            ariaLabel={`IMF Bz over the last ${feed.metadata.windowHours} hours in nT; latest ${n1.format(bz.at(-1)!.v)}.`}
          />
          <figcaption className="mt-1 text-[11px] leading-snug text-fg-subtle">
            Bz GSM, nT · last {feed.metadata.windowHours} h, 1-minute samples, UTC · {spacecraftIn(bz)}
          </figcaption>
        </figure>
      )}
      <Provenance
        observedAt={latest?.observedAt}
        ingestedAt={feed?.metadata.ingestedAt}
        spacecraft={d?.spacecraft}
        sourceName={feed?.source.name}
      />
    </Section>
  );
}
