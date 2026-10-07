import type {
  AirTrafficFeed,
  AuroraForecastFeed,
  CloudCoverFeed,
  EarthquakeFeed,
  EarthquakeObservation,
  EonetEventObservation,
  EonetFeed,
  GoesXrayFeed,
  InterplanetaryMagneticFieldFeed,
  IssFeed,
  Observation,
  PlanetaryKpFeed,
  SolarWindPlasmaFeed,
  WeatherPointFeed,
} from "@/types";
import { AIRCRAFT_ENTITY_PREFIX, AIR_VISUAL_DELAY_MS } from "@/lib/sources/opensky/source";
import { ROW, rowToAircraft } from "@/lib/sources/opensky/rows";
import { ISS_ENTITY_ID } from "@/lib/sources/wtia/source";
import { EONET_ENTITY_PREFIX } from "@/lib/sources/nasa/eonet-source";
import { eonetCategories, latestGeometryTime } from "@/lib/eonet-filters";
import { WMO_WEATHER_CODES } from "@/lib/weather-codes";
import { xrayClassBand } from "@/lib/xray";
import { bzOrientation } from "@/lib/solar-wind";
import type { AiFocusKind } from "./types";

/**
 * Domain Capsules: small AI-specific summaries built from the data AURELIS
 * already holds. Never the UI/data objects themselves: no grids, GeoJSON,
 * trails, histories or aircraft lists. Every value keeps its nature, time
 * and source; null = not provided (never 0). Source text is clipped data.
 */

export interface CapsuleData {
  iss: IssFeed | null;
  kp: PlanetaryKpFeed | null;
  plasma: SolarWindPlasmaFeed | null;
  mag: InterplanetaryMagneticFieldFeed | null;
  xray: GoesXrayFeed | null;
  aurora: AuroraForecastFeed | null;
  earthquakes: EarthquakeFeed | null;
  eonet: EonetFeed | null;
  /** EONET events the map currently draws (after the view filters). */
  eonetInView: EonetEventObservation[];
  eonetFilters: { recency: string; categoryId: string | null };
  weather: WeatherPointFeed | null;
  clouds: { shown: boolean; feed: CloudCoverFeed | null };
  air: { pollingActive: boolean; shown: boolean; quotaLow: boolean; feed: AirTrafficFeed | null };
}

/** Detail level, lowered by the budget loop. */
export interface CapsuleLimits {
  listItems: number;
  weatherHours: number;
  brief: boolean;
}

/** Source text is untrusted data: bounded length, no control characters. */
export function clip(text: string | null | undefined, max: number): string | null {
  if (typeof text !== "string") return null;
  const clean = text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Missing stays null (never 0); non-finite numbers are not data. */
export const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const round = (v: number | null | undefined, digits: number): number | null => {
  const n = num(v);
  return n === null ? null : Number(n.toFixed(digits));
};
/** ISO time without milliseconds ("2026-10-07T16:32:43Z"); null when absent. */
export const t = (v: string | null | undefined): string | null =>
  typeof v === "string" && v ? v.replace(/\.\d+Z$/, "Z") : null;

const pos = (loc: { latitude: number; longitude: number } | undefined | null) =>
  loc && num(loc.latitude) !== null && num(loc.longitude) !== null
    ? { lat: round(loc.latitude, 3)!, lon: round(loc.longitude, 3)! }
    : null;

/** Drops undefined keys (absent decorations), keeps null (absent measurements). */
function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const byId = <O extends { id: string }>(list: O[] | undefined, id: string | null | undefined) =>
  id ? (list?.find((o) => o.id === id) ?? null) : null;

const maxOf = (values: (number | null)[]) =>
  values.reduce<number | null>((m, v) => (v !== null && (m === null || v > m) ? v : m), null);

// ---------------------------------------------------------------- SPACE

export function spaceCapsule(d: CapsuleData) {
  const { iss, kp, plasma, mag, xray, aurora } = d;
  if (!iss && !kp && !plasma && !mag && !xray && !aurora) return null;
  const issObs = iss?.observations.find((o) => o.entityId === ISS_ENTITY_ID) ?? null;
  const kpNow = byId(kp?.observations, kp?.latestObservationId);
  const p = byId(plasma?.observations, plasma?.latestObservationId);
  const b = byId(mag?.observations, mag?.latestObservationId);
  const flux = byId(xray?.flux, xray?.latestFluxId);
  const flare = xray?.latestFlare ?? null;
  const a = aurora?.observation ?? null;
  const bz = num(b?.data.bzGsmNt);
  const fluxNow = flux ? num(flux.data.fluxWattsPerM2) : null;

  return compact({
    iss: issObs && iss
      ? { ...pos(issObs.location), altKm: round(issObs.data.altitudeKm, 1), at: t(issObs.observedAt), nature: issObs.nature, source: iss.source.name }
      : undefined,
    kp: kpNow && kp
      ? {
          kp: round(kpNow.data.estimatedKp, 2),
          [`max${kp.metadata.windowHours}h`]: round(maxOf(kp.observations.map((o) => num(o.data.estimatedKp))), 2),
          at: t(kpNow.observedAt),
          nature: kpNow.nature,
          source: kp.source.name,
        }
      : undefined,
    solarWind: p && plasma
      ? {
          speedKms: round(p.data.protonSpeedKms, 0),
          densityCm3: round(p.data.protonDensityPerCm3, 2),
          tempK: num(p.data.protonTemperatureK) === null ? null : Math.round(p.data.protonTemperatureK! / 100) * 100,
          at: t(p.observedAt),
          nature: p.nature,
          source: plasma.source.name,
        }
      : undefined,
    imf: b && mag
      ? {
          bzNt: round(bz, 1),
          btNt: round(b.data.btNt, 1),
          bzDirection: bz === null ? null : bzOrientation(bz).toLowerCase(),
          at: t(b.observedAt),
          nature: b.nature,
          source: mag.source.name,
        }
      : undefined,
    xray: xray
      ? compact({
          fluxWm2: fluxNow === null ? null : Number(fluxNow.toPrecision(3)),
          decadeBand: fluxNow === null ? null : xrayClassBand(fluxNow),
          [`maxFlux${xray.metadata.windowHours}hWm2`]: (() => {
            const m = maxOf(xray.flux.map((o) => num(o.data.fluxWattsPerM2)));
            return m === null ? null : Number(m.toPrecision(3));
          })(),
          at: flux ? t(flux.observedAt) : null,
          nature: flux?.nature ?? null,
          latestFlare: flare
            ? compact({ class: clip(flare.data.flareClass, 8), begin: t(flare.data.beginTime), peak: t(flare.data.peakTime), end: t(flare.data.endTime) ?? undefined, nature: flare.nature })
            : null,
          source: xray.source.name,
          note: "decadeBand = band of the instantaneous flux, not a flare class",
        })
      : undefined,
    aurora: a && aurora
      ? { validAt: t(a.data.forecastTime), inputObservedAt: t(a.data.inputObservationTime), peakProbability: num(a.data.peakValue), activeCells: num(a.data.activeGridCells), nature: a.nature, source: aurora.source.name }
      : undefined,
  });
}

// ---------------------------------------------------------------- DISASTERS

export function earthquakeLabel(o: EarthquakeObservation): string {
  const m = num(o.data.magnitude);
  const place = clip(o.data.place, 60);
  return [m === null ? "M?" : `M${m.toFixed(1)}`, place?.toUpperCase()].filter(Boolean).join(" · ");
}

function quakeItem(o: EarthquakeObservation, brief: boolean) {
  return compact({
    mag: num(o.data.magnitude),
    place: clip(o.data.place, brief ? 60 : 100),
    at: t(o.observedAt),
    ...pos(o.location),
    depthKm: round(o.data.depthKm, 0),
    alert: o.data.alert ? clip(o.data.alert, 10) : undefined,
    tsunami: o.data.tsunamiFlag ? true : undefined,
  });
}

/** Latest EONET position when it is a Point ([lon, lat], approximate); polygons get no invented centroid. */
export function eonetPoint(o: EonetEventObservation) {
  const g = o.data.geometries[o.data.latestGeometryIndex];
  if (g?.type !== "Point") return null;
  const [longitude, latitude] = g.coordinates as number[];
  return pos({ latitude, longitude });
}

function eonetItem(o: EonetEventObservation, brief: boolean) {
  const g = o.data.geometries[o.data.latestGeometryIndex];
  const m = g && num(g.magnitudeValue) !== null ? `${g.magnitudeValue} ${clip(g.magnitudeUnit, 12) ?? ""}`.trim() : undefined;
  return compact({
    title: clip(o.data.title, brief ? 60 : 100),
    category: o.data.categories.map((c) => clip(c.title, 30)).join(", "),
    latestAt: t(g?.date),
    ...(eonetPoint(o) ?? { geometry: g?.type === "Polygon" ? "polygon" : undefined }),
    magnitude: m,
  });
}

export function disastersCapsule(d: CapsuleData, lim: CapsuleLimits) {
  const { earthquakes: eq, eonet } = d;
  if (!eq && !eonet) return null;
  const quakes = eq?.observations ?? [];
  const mags = quakes.map((o) => num(o.data.magnitude));
  const largest = [...quakes]
    .sort((x, y) => (num(y.data.magnitude) ?? -Infinity) - (num(x.data.magnitude) ?? -Infinity) || (y.observedAt ?? "").localeCompare(x.observedAt ?? ""))
    .slice(0, lim.listItems);
  const recent = [...d.eonetInView]
    .sort((x, y) => (latestGeometryTime(y) || 0) - (latestGeometryTime(x) || 0))
    .slice(0, lim.listItems);
  return compact({
    earthquakes: eq
      ? {
          source: `${eq.source.name} (M2.5+, past day)`,
          nature: quakes[0]?.nature ?? "reported",
          total: quakes.length,
          m4_5plus: mags.filter((m) => m !== null && m >= 4.5).length,
          m6plus: mags.filter((m) => m !== null && m >= 6).length,
          latestAt: t(quakes.reduce<string | null>((m, o) => (o.observedAt && (!m || o.observedAt > m) ? o.observedAt : m), null)),
          largest: largest.map((o) => quakeItem(o, lim.brief)),
        }
      : undefined,
    eonet: eonet
      ? {
          source: `${eonet.source.name} (open natural events; earthquakes excluded)`,
          nature: "reported",
          open: eonet.observations.length,
          inView: d.eonetInView.length,
          viewFilter: [d.eonetFilters.recency, d.eonetFilters.categoryId].filter(Boolean).join(" · "),
          categories: eonetCategories(eonet.observations)
            .slice(0, lim.brief ? 3 : 5)
            .map((c) => `${clip(c.title, 30)}: ${c.count}`),
          mostRecentInView: recent.map((o) => eonetItem(o, lim.brief)),
        }
      : undefined,
  });
}

// ---------------------------------------------------------------- WEATHER

const describeCode = (code: number | null | undefined) =>
  typeof code === "number" && Object.hasOwn(WMO_WEATHER_CODES, code) ? WMO_WEATHER_CODES[code] : null;

export function weatherCapsule(d: CapsuleData, lim: CapsuleLimits, nowMs: number) {
  const { weather: w, clouds } = d;
  const cf = clouds.feed;
  if (!w && !cf) return null;
  const c = w?.current.data;
  const next = w ? w.hourly.filter((h) => Date.parse(h.validAt ?? "") > nowMs - 3_600_000).slice(0, lim.weatherHours) : [];
  return compact({
    point: w && c
      ? {
          requested: pos(w.requestedLocation),
          gridCell: { ...pos(w.gridCell), elevationM: num(w.gridCell.elevationM) },
          source: `${w.source.name} (${w.model})`,
          current: compact({
            tempC: num(c.temperatureC),
            feelsC: num(c.apparentTemperatureC),
            humidityPct: num(c.relativeHumidityPercent),
            cloudPct: num(c.cloudCoverPercent),
            precipMm: num(c.precipitationMm),
            windKmh: num(c.windSpeedKmh),
            gustKmh: num(c.windGustsKmh),
            windDirDeg: num(c.windDirectionDegrees),
            pressureHpa: num(c.pressureMslHpa),
            sky: describeCode(c.weatherCode),
            validAt: t(w.current.validAt),
            nature: w.current.nature,
          }),
          nextHours: next.map((h) =>
            compact({
              validAt: t(h.validAt),
              tempC: num(h.data.temperatureC),
              cloudPct: num(h.data.cloudCoverPercent),
              precipProbPct: num(h.data.precipitationProbabilityPercent),
              precipMm: num(h.data.precipitationMm),
              windKmh: num(h.data.windSpeedKmh),
              sky: describeCode(h.data.weatherCode),
              nature: h.nature,
            }),
          ),
        }
      : "no point inspected",
    globalClouds: cf
      ? {
          shownOnMap: clouds.shown,
          model: `${cf.observation.data.model} total cloud cover`,
          run: t(cf.observation.data.runTime),
          forecastHour: cf.observation.data.forecastHour,
          validAt: t(cf.observation.data.validAt),
          globalMeanPct: round(cf.observation.data.meanPercent, 1),
          nature: cf.observation.nature,
          source: cf.source.name,
        }
      : "not loaded",
  });
}

// ---------------------------------------------------------------- AIR

/** Counts and freshness only: never the snapshot, never ICAO24 lists. */
export function airCapsule(d: CapsuleData, nowMs: number) {
  const { feed, pollingActive, shown, quotaLow } = d.air;
  if (!feed) return null;
  const m = feed.metadata;
  return compact({
    source: feed.source.name,
    nature: "reported",
    polling: pollingActive ? "active" : "paused",
    shownOnMap: pollingActive && shown,
    stateAt: t(m.stateTime),
    ageS: Math.max(0, Math.round((nowMs - Date.parse(m.ingestedAt)) / 1000)),
    totalStates: m.totalStates,
    withPosition: feed.aircraft.length,
    onGround: feed.aircraft.filter((r) => r[ROW.onGround] === true).length,
    withoutPosition: m.withoutPosition,
    staleDropped: m.stalePosition,
    mapDelayS: AIR_VISUAL_DELAY_MS / 1000,
    quotaLow: quotaLow ? true : undefined,
    note: "coverage depends on receivers; absence from a snapshot means nothing by itself",
  });
}

// ---------------------------------------------------------------- FOCUS

export interface FocusCapsule {
  kind: AiFocusKind;
  label: string;
  source: string;
  nature: string;
  confidence: string;
  observedAt: string | null;
  reportedAt?: string | null;
  ingestedAt: string | null;
  location: Record<string, unknown> | null;
  sourceRecordId?: string;
  sourceUrl?: string;
  data: Record<string, unknown>;
  note?: string;
}

function focusBase(o: Observation, source: string) {
  return compact({
    source,
    nature: o.nature,
    confidence: o.confidence,
    observedAt: t(o.observedAt),
    reportedAt: o.reportedAt ? t(o.reportedAt) : undefined,
    ingestedAt: t(o.ingestedAt),
    location: o.location && pos(o.location)
      ? compact({ ...pos(o.location)!, precision: o.location.precision, altM: num(o.location.altitudeMeters) ?? undefined })
      : null,
    sourceRecordId: o.sourceRecordId,
    sourceUrl: o.sourceUrl,
  });
}

/** Kind of the selected entity if it still exists in its source (else null: nothing to focus on). */
export function focusKindOf(entityId: string | null, d: Pick<CapsuleData, "iss" | "earthquakes" | "eonet" | "air">): AiFocusKind | null {
  if (!entityId) return null;
  if (entityId === ISS_ENTITY_ID) return d.iss?.observations.some((o) => o.entityId === entityId) ? "iss" : null;
  if (entityId.startsWith(EONET_ENTITY_PREFIX)) return d.eonet?.observations.some((o) => o.entityId === entityId) ? "eonet_event" : null;
  if (entityId.startsWith(AIRCRAFT_ENTITY_PREFIX)) {
    const icao24 = entityId.slice(AIRCRAFT_ENTITY_PREFIX.length);
    return d.air.feed?.aircraft.some((r) => r[ROW.icao24] === icao24) ? "aircraft" : null;
  }
  if (entityId.startsWith("earthquake:")) return d.earthquakes?.observations.some((o) => o.entityId === entityId) ? "earthquake" : null;
  return null;
}

/** The selected entity: only that entity, its observation, provenance and specialized data. */
export function focusCapsule(entityId: string | null, d: Pick<CapsuleData, "iss" | "earthquakes" | "eonet" | "air">, brief = false): FocusCapsule | null {
  const kind = focusKindOf(entityId, d);
  if (!kind || !entityId) return null;
  if (kind === "iss") {
    const o = d.iss!.observations.find((x) => x.entityId === entityId)!;
    return {
      kind,
      label: "ISS",
      ...focusBase(o, d.iss!.source.name),
      data: compact({ name: "International Space Station", noradId: o.data.noradId, altKm: round(o.data.altitudeKm, 1), visibility: clip(o.data.visibility, 24) ?? undefined }),
      note: "velocity omitted: the source does not publish its unit",
    } as FocusCapsule;
  }
  if (kind === "eonet_event") {
    const o = d.eonet!.observations.find((x) => x.entityId === entityId)!;
    const point = eonetPoint(o);
    return {
      kind,
      label: clip(o.data.title, 48)?.toUpperCase() ?? "EONET EVENT",
      ...focusBase(o, d.eonet!.source.name),
      location: point ? { ...point, precision: "approximate" } : null,
      data: compact({
        ...eonetItem(o, brief),
        description: clip(o.data.description, brief ? 160 : 400) ?? undefined,
        firstAt: t(o.data.geometries[0]?.date),
        geometries: o.data.geometries.length,
        upstream: o.data.upstreamSources.slice(0, 3).map((s) => clip(s.id, 24)).join(", "),
      }),
      note: "EONET aggregates reports from upstream sources; locations approximate",
    } as FocusCapsule;
  }
  if (kind === "aircraft") {
    const feed = d.air.feed!;
    const icao24 = entityId.slice(AIRCRAFT_ENTITY_PREFIX.length);
    const row = feed.aircraft.find((r) => r[ROW.icao24] === icao24)!;
    const { observation: o } = rowToAircraft(row, feed.metadata.stateTime, feed.metadata.ingestedAt);
    return {
      kind,
      label: o.data.callsign?.trim() || icao24.toUpperCase(),
      ...focusBase(o, feed.source.name),
      data: compact({
        icao24,
        callsign: clip(o.data.callsign, 12) ?? undefined,
        originCountry: clip(o.data.originCountry, 40) ?? undefined,
        onGround: o.data.onGround,
        baroAltM: num(o.data.baroAltitudeM) ?? undefined,
        geoAltM: num(o.data.geoAltitudeM) ?? undefined,
        speedMs: num(o.data.velocityMps) ?? undefined,
        trackDeg: num(o.data.trueTrackDeg) ?? undefined,
        vertRateMs: num(o.data.verticalRateMps) ?? undefined,
        squawk: o.data.squawk,
        positionSource: o.data.positionSource,
        positionAt: t(o.data.timePosition),
        lastContact: t(o.data.lastContact),
      }),
      note: "latest REAL state (map position is interpolated for display only)",
    } as FocusCapsule;
  }
  const o = d.earthquakes!.observations.find((x) => x.entityId === entityId)!;
  return {
    kind,
    label: earthquakeLabel(o),
    ...focusBase(o, d.earthquakes!.source.name),
    data: compact({
      ...quakeItem(o, brief),
      magType: clip(o.data.magnitudeType, 8) ?? undefined,
      status: clip(o.data.status, 16) ?? undefined,
      significance: num(o.data.significance) ?? undefined,
      tsunamiFlag: o.data.tsunamiFlag,
      network: clip(o.data.preferredNetwork, 8) ?? undefined,
    }),
  } as FocusCapsule;
}
