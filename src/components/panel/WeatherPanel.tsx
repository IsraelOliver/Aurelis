import type { SourceHealth, WeatherPointFeed } from "@/types";
import { formatLatitude, formatLongitude } from "@/lib/format";
import { WMO_WEATHER_CODES } from "@/lib/weather-codes";
import { CC_BY_4_URL, OPEN_METEO_LICENCE_URL } from "@/lib/sources/open-meteo/source";
import { EMPTY, Note, PanelShell, Row, Section, Time } from "./primitives";
import SeriesChart, { type SeriesPoint } from "./SeriesChart";
import { Tag } from "./SolarWindSections";

const n1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const unit = (v: number | undefined, u: string) => (v === undefined ? EMPTY : `${n1.format(v)} ${u}`);

/**
 * WEATHER domain panel: point inspection with Open-Meteo (Best Match). Shows
 * the snapshot of the CURRENT point only (never another point's data). Current
 * conditions are model estimates; the next 24 hours are forecasts. Times UTC.
 * Attribution (CC BY 4.0) next to the data, as Open-Meteo requires.
 */
export default function WeatherPanel({
  point,
  feed,
  health,
  failed,
  onClose,
}: {
  /** Point chosen on the map, or null before any click. */
  point: { latitude: number; longitude: number } | null;
  /** Snapshot for `point` only. */
  feed: WeatherPointFeed | null;
  health: SourceHealth;
  /** Last attempt for this point failed. */
  failed: boolean;
  onClose: () => void;
}) {
  if (!point) {
    return (
      <PanelShell eyebrow="WEATHER" title="Select a point on the map" onClose={onClose}>
        <Section title="POINT INSPECTION">
          <p className="py-1.5 text-[12px] leading-relaxed text-fg-muted">
            Click anywhere on the map to inspect modeled weather conditions and the next 24 hours.
          </p>
          <Note>Clicking an earthquake, EONET event or the ISS still selects it.</Note>
        </Section>
      </PanelShell>
    );
  }

  const c = feed?.current.data;
  const code = c?.weatherCode;
  const hourly = feed?.hourly ?? [];
  const pts = (pick: (o: (typeof hourly)[number]) => number | undefined): SeriesPoint[] =>
    hourly.flatMap((o) => {
      const v = pick(o);
      return v === undefined ? [] : [{ t: Date.parse(o.validAt!), v, group: "open-meteo" }];
    });
  const temp = pts((o) => o.data.temperatureC);
  const cloud = pts((o) => o.data.cloudCoverPercent);
  const pop = pts((o) => o.data.precipitationProbabilityPercent);
  const domain: [number, number] | undefined =
    hourly.length > 1 ? [Date.parse(hourly[0].validAt!), Date.parse(hourly[hourly.length - 1].validAt!)] : undefined;
  const tMin = temp.length ? Math.floor(Math.min(...temp.map((p) => p.v)) / 5) * 5 : 0;
  const tMax = temp.length ? Math.ceil(Math.max(...temp.map((p) => p.v)) / 5) * 5 : 5;
  const precipValues = hourly.flatMap((o) => (o.data.precipitationMm === undefined ? [] : [o.data.precipitationMm]));
  const precipSum = precipValues.reduce((a, b) => a + b, 0);

  return (
    <PanelShell eyebrow="WEATHER" title="Point weather" sourceHealth={feed ? health : undefined} onClose={onClose}>
      <Section title="REQUESTED POINT">
        <span className="font-mono text-[12px] text-fg">
          {formatLatitude(point.latitude)} · {formatLongitude(point.longitude)}
        </span>
        {feed && (
          <Note>
            Model grid cell centre {formatLatitude(feed.gridCell.latitude)} ·{" "}
            {formatLongitude(feed.gridCell.longitude)}
            {feed.gridCell.elevationM !== undefined ? ` · elevation ${n1.format(feed.gridCell.elevationM)} m` : ""}
          </Note>
        )}
        {!feed && !failed && <Note>Loading Open-Meteo data for this point…</Note>}
        {!feed && failed && (
          <p role="status" className="mt-2 rounded border border-line px-3 py-2 text-[11px] text-fg-muted">
            WEATHER SOURCE UNAVAILABLE for this point. No data from another point is shown.
          </p>
        )}
      </Section>

      {feed && (
        <>
          <Section title="CURRENT CONDITIONS">
            <div className="flex items-baseline gap-2 py-1.5">
              <span className="font-mono text-[26px] leading-none text-gold">
                {c?.temperatureC !== undefined ? `${n1.format(c.temperatureC)} °C` : EMPTY}
              </span>
              <span className="ml-auto">
                <Tag>ESTIMATED</Tag>
              </span>
            </div>
            <Note>Current conditions are model-derived, not a direct station observation.</Note>
            <dl className="mt-1">
              <Row label="CONDITION">
                {code !== undefined ? (
                  <>
                    {WMO_WEATHER_CODES[code]}
                    <Note>WMO code {code}</Note>
                  </>
                ) : (
                  EMPTY
                )}
              </Row>
              <Row label="FEELS LIKE">{unit(c?.apparentTemperatureC, "°C")}</Row>
              <Row label="HUMIDITY">{unit(c?.relativeHumidityPercent, "%")}</Row>
              <Row label="CLOUD COVER">{unit(c?.cloudCoverPercent, "%")}</Row>
              <Row label="PRECIPITATION">{unit(c?.precipitationMm, "mm")}</Row>
              <Row label="WIND">
                {unit(c?.windSpeedKmh, "km/h")}
                {c?.windDirectionDegrees !== undefined && <Note>Direction {n1.format(c.windDirectionDegrees)}°</Note>}
              </Row>
              <Row label="GUSTS">{unit(c?.windGustsKmh, "km/h")}</Row>
              <Row label="PRESSURE (MSL)">{unit(c?.pressureMslHpa, "hPa")}</Row>
              <Row label="VALID AT">
                <Time iso={feed.current.validAt} />
                {c?.intervalSeconds !== undefined && <Note>{n1.format(c.intervalSeconds / 60)}-minute model interval.</Note>}
              </Row>
            </dl>
          </Section>

          <Section title="NEXT 24 HOURS">
            <div className="py-1">
              <Tag>FORECAST</Tag>
            </div>
            {temp.length > 0 && (
              <figure className="mt-1">
                <SeriesChart
                  points={temp}
                  windowHours={24}
                  domain={domain}
                  maxGapMs={2 * 3_600_000}
                  markLatest={false}
                  tickEveryHours={6}
                  yMin={tMin}
                  yMax={tMax}
                  yTicks={[tMin, Math.round((tMin + tMax) / 2), tMax]}
                  ariaLabel={`Temperature forecast for the next 24 hours, °C, from ${Math.min(...temp.map((p) => p.v))} to ${Math.max(...temp.map((p) => p.v))}.`}
                />
                <figcaption className="mt-1 text-[11px] text-fg-subtle">Temperature (2 m), °C · hourly, UTC</figcaption>
              </figure>
            )}
            {(cloud.length > 0 || pop.length > 0) && (
              <figure className="mt-3">
                <SeriesChart
                  points={cloud.length > 0 ? cloud : pop}
                  secondaryPoints={cloud.length > 0 ? pop : undefined}
                  windowHours={24}
                  domain={domain}
                  maxGapMs={2 * 3_600_000}
                  markLatest={false}
                  tickEveryHours={6}
                  yMin={0}
                  yMax={100}
                  yTicks={[0, 50, 100]}
                  ariaLabel="Cloud cover and precipitation probability for the next 24 hours, percent."
                />
                <figcaption className="mt-1 text-[11px] text-fg-subtle">
                  <span className="text-cyan">—</span> Cloud cover % · <span className="text-fg-muted">- -</span>{" "}
                  Precipitation probability % · hourly, UTC
                </figcaption>
              </figure>
            )}
            <dl className="mt-2">
              <Row label="PRECIP. (24 H)">
                {precipValues.length > 0 ? `${n1.format(precipSum)} mm` : EMPTY}
                <Note>Sum of the hourly forecast amounts.</Note>
              </Row>
            </dl>
          </Section>

          <Section title="PROVENANCE">
            <Row label="MODEL">
              OPEN-METEO BEST MATCH
              <Note>The specific upstream model is not reported in the response.</Note>
            </Row>
            <Row label="INGESTED">
              <Time iso={feed.metadata.ingestedAt} />
            </Row>
            <Row label="SOURCE">{feed.source.name}</Row>
            <Row label="NATURE">
              ESTIMATED (current)
              <Note>Next hours: FORECAST.</Note>
            </Row>
            <Row label="AURELIS CONFIDENCE">UNKNOWN</Row>
          </Section>
        </>
      )}

      <div className="border-t border-line px-4 py-3 text-[11px] text-fg-subtle">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-fg-muted underline decoration-line-strong underline-offset-2 hover:text-fg">
          Weather data by Open-Meteo.com
        </a>
        {" · "}
        <a href={CC_BY_4_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-fg-muted">
          CC BY 4.0
        </a>
        {" · "}
        <a href={OPEN_METEO_LICENCE_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-fg-muted">
          licence
        </a>
        <span className="mt-0.5 block">Values as received; layout and 24 h sum by AURELIS. Times UTC.</span>
      </div>
    </PanelShell>
  );
}
