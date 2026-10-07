"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuroraForecastFeed,
  EarthquakeFeed,
  WeatherPointFeed,
  EonetFeed,
  GoesXrayFeed,
  InterplanetaryMagneticFieldFeed,
  IssFeed,
  PlanetaryKpFeed,
  SolarWindPlasmaFeed,
  SourceSyncState,
} from "@/types";
import {
  ISS_SYNC,
  NASA_EONET_SYNC,
  NOAA_KP_SYNC,
  NOAA_OVATION_SYNC,
  NOAA_RTSW_SYNC,
  NOAA_XRAY_SYNC,
  OPEN_METEO_SYNC,
  NOAA_GFS_CLOUDS_SYNC,
  USGS_SYNC,
  aggregateHealth,
  deriveHealth,
  type SyncConfig,
} from "@/lib/source-health";
import { USGS_EARTHQUAKES_SOURCE } from "@/lib/sources/usgs/source";
import { ISS_ENTITY_ID, WTIA_ISS_SOURCE } from "@/lib/sources/wtia/source";
import { EONET_ENTITY_PREFIX, NASA_EONET_SOURCE } from "@/lib/sources/nasa/eonet-source";
import { OPEN_METEO_SOURCE } from "@/lib/sources/open-meteo/source";
import {
  NOAA_SWPC_KP_SOURCE,
  NOAA_SWPC_OVATION_SOURCE,
  NOAA_SWPC_RTSW_MAG_SOURCE,
  NOAA_SWPC_RTSW_WIND_SOURCE,
  NOAA_SWPC_GOES_XRAY_SOURCE,
} from "@/lib/sources/noaa/source";
import { appendTrailPoint, trailToSegments, type TrailPoint } from "@/lib/iss-trail";
import { DEFAULT_LAYER_VISIBILITY, type MapLayerId, type MapLayerVisibility } from "@/lib/map-layers";
import {
  DEFAULT_EONET_FILTERS,
  eonetCategories,
  filterEonet,
  selectionHiddenByFilters,
  type EonetViewFilters,
} from "@/lib/eonet-filters";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import MapView from "@/components/map/MapView";
import EarthquakePanel from "@/components/panel/EarthquakePanel";
import EonetEventPanel from "@/components/panel/EonetEventPanel";
import DisastersPanel from "@/components/panel/DisastersPanel";
import WeatherPanel from "@/components/panel/WeatherPanel";
import IssPanel from "@/components/panel/IssPanel";
import SpaceWeatherPanel from "@/components/panel/SpaceWeatherPanel";
import { useSourceSync, type SourceSync } from "./useSourceSync";
import { useCloudCover } from "./useCloudCover";
import { NOAA_GFS_CLOUDS_SOURCE } from "@/lib/sources/noaa/gfs-source";

/** Display clock for relative times and freshness; never triggers a fetch. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function toSyncState(
  sourceId: string,
  sync: SourceSync<{ metadata: { ingestedAt: string } }>,
  config: SyncConfig,
  now: number,
): SourceSyncState & { snapshotAgeMs: number | null } {
  const snapshotAgeMs =
    sync.ageAtReceiptMs !== undefined && sync.receivedAtMs !== undefined
      ? sync.ageAtReceiptMs + Math.max(0, now - sync.receivedAtMs)
      : null;
  return {
    sourceId,
    health: deriveHealth({
      hasSnapshot: sync.snapshot !== null,
      attempted: sync.attempted,
      lastAttemptFailed: sync.lastAttemptFailed,
      snapshotAgeMs,
      freshnessWindowMs: config.freshnessWindowMs,
    }),
    lastAttemptAt: sync.lastAttemptAt,
    lastSuccessAt: sync.lastSuccessAt,
    lastIngestedAt: sync.snapshot?.metadata.ingestedAt,
    snapshotAgeMs,
  };
}

/**
 * What the single right-hand panel shows: a selected Entity (map data) or a
 * domain view of global, non-geographic data (no Entity, nothing on the map).
 */
export type PanelTarget =
  | { type: "entity"; entityId: string }
  | { type: "domain"; domain: DomainId };

/** Sidebar domains that open a domain panel. */
export type DomainId = "space" | "disasters" | "weather";

/** Weather query point: clicked coordinate rounded to 5 decimals (~1 m), longitude wrapped. */
type WeatherPoint = { latitude: number; longitude: number };
const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/** Clears an entity target when that entity left its source; domain targets are kept. */
const pruneEntity =
  (stillExists: (entityId: string) => boolean, owns: (entityId: string) => boolean) =>
  (target: PanelTarget | null): PanelTarget | null =>
    target?.type === "entity" && owns(target.entityId) && !stillExists(target.entityId)
      ? null
      : target;

const noop = () => {};

/**
 * Client shell that owns the data state shared by topbar, map, sidebar,
 * panel and status bar. Each source syncs independently and has its own
 * SourceHealth; only the latest snapshot of each is kept (no history). The
 * one exception is the ISS recent tracked path: a bounded in-memory list of
 * received positions (see lib/iss-trail.ts), never persisted.
 * Entity selection is keyed by Entity ID, never by Observation ID: it survives
 * updates of the same entity and is cleared when the entity leaves its source.
 */
export default function Workspace() {
  const [panelTarget, setPanelTarget] = useState<PanelTarget | null>(null);
  const selectedEntityId = panelTarget?.type === "entity" ? panelTarget.entityId : null;
  const selectEntity = useCallback((entityId: string) => {
    setPanelTarget({ type: "entity", entityId });
  }, []);

  const onUsgsSnapshot = useCallback((feed: EarthquakeFeed) => {
    setPanelTarget(
      pruneEntity(
        (id) => feed.entities.some((e) => e.id === id),
        (id) => id.startsWith("earthquake:"),
      ),
    );
  }, []);
  const [issTrail, setIssTrail] = useState<TrailPoint[]>([]);
  const onEonetSnapshot = useCallback((feed: EonetFeed) => {
    setPanelTarget(
      pruneEntity(
        (id) => feed.entities.some((e) => e.id === id),
        (id) => id.startsWith(EONET_ENTITY_PREFIX),
      ),
    );
  }, []);
  const onIssSnapshot = useCallback((feed: IssFeed) => {
    setPanelTarget(
      pruneEntity(
        (id) => feed.entities.some((e) => e.id === id),
        (id) => id === ISS_ENTITY_ID,
      ),
    );
    // Only received positions extend the path; failed polls add nothing.
    const observation = feed.observations.find((o) => o.entityId === ISS_ENTITY_ID);
    if (observation?.location && observation.observedAt) {
      const point = {
        lon: observation.location.longitude,
        lat: observation.location.latitude,
        t: Date.parse(observation.observedAt),
        altitudeKm: observation.data.altitudeKm,
      };
      setIssTrail((trail) => appendTrailPoint(trail, point));
    }
  }, []);
  const issTrailSegments = useMemo(() => trailToSegments(issTrail), [issTrail]);

  const usgs = useSourceSync<EarthquakeFeed>(
    "/api/earthquakes",
    USGS_SYNC.pollIntervalMs,
    "Earthquake",
    onUsgsSnapshot,
  );
  const iss = useSourceSync<IssFeed>(
    "/api/space/iss",
    ISS_SYNC.pollIntervalMs,
    "ISS",
    onIssSnapshot,
  );
  // NASA EONET open natural events (earthquakes excluded): entities on the map.
  const eonet = useSourceSync<EonetFeed>(
    "/api/disasters/eonet",
    NASA_EONET_SYNC.pollIntervalMs,
    "NASA EONET",
    onEonetSnapshot,
  );
  // Global index, no entity: only feeds the SPACE domain panel.
  const kp = useSourceSync<PlanetaryKpFeed>(
    "/api/space/weather/kp",
    NOAA_KP_SYNC.pollIntervalMs,
    "NOAA SWPC Kp",
    noop,
  );
  // Modeled field, no entity: feeds the optional aurora layer and the SPACE panel.
  const aurora = useSourceSync<AuroraForecastFeed>(
    "/api/space/weather/aurora",
    NOAA_OVATION_SYNC.pollIntervalMs,
    "NOAA SWPC OVATION",
    noop,
  );
  // Real-time solar wind: two independent feeds (fetch, errors, health), no entity, nothing on the map.
  const plasma = useSourceSync<SolarWindPlasmaFeed>(
    "/api/space/weather/solar-wind/plasma",
    NOAA_RTSW_SYNC.pollIntervalMs,
    "NOAA SWPC RTSW plasma",
    noop,
  );
  const mag = useSourceSync<InterplanetaryMagneticFieldFeed>(
    "/api/space/weather/solar-wind/mag",
    NOAA_RTSW_SYNC.pollIntervalMs,
    "NOAA SWPC RTSW mag",
    noop,
  );
  // GOES X-ray flux + latest official event: one product, one health; no entity, nothing on the map.
  const xray = useSourceSync<GoesXrayFeed>(
    "/api/space/weather/xray",
    NOAA_XRAY_SYNC.pollIntervalMs,
    "NOAA SWPC GOES X-ray",
    noop,
  );
  // Map layer visibility: rendering/interaction only (session state, not persisted).
  // Data keeps syncing; entities, observations and health are unaffected.
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  /** Entity prefix of each layer whose selection must close when the layer is hidden. */
  const selectionOwner: Partial<Record<MapLayerId, (entityId: string) => boolean>> = {
    earthquakes: (id) => id.startsWith("earthquake:"),
    eonet: (id) => id.startsWith(EONET_ENTITY_PREFIX),
  };
  const setLayers = (next: Partial<MapLayerVisibility>) => {
    const hidden = (Object.keys(next) as MapLayerId[]).filter((id) => next[id] === false);
    const owned = panelTarget?.type === "entity" && hidden.some((id) => selectionOwner[id]?.(panelTarget.entityId));
    // A selected entity that is no longer drawn: back to the DISASTERS summary.
    if (owned) setPanelTarget({ type: "domain", domain: "disasters" });
    // Functional merge: never overwrite other layers with a stale render's values.
    setLayerVisibility((prev) => ({ ...prev, ...next }));
  };
  const toggleLayer = (id: MapLayerId) => setLayers({ [id]: !layerVisibility[id] });
  const now = useNow(1000);

  // WEATHER (Open-Meteo, query-scoped): the point chosen on the map; session state only.
  // No point = no query, no polling, and the source is not listed or counted.
  const [weatherPoint, setWeatherPoint] = useState<WeatherPoint | null>(null);
  const pickWeatherPoint = useCallback((p: WeatherPoint) => {
    setWeatherPoint({ latitude: round5(p.latitude), longitude: round5(p.longitude) });
  }, []);
  const weather = useSourceSync<WeatherPointFeed>(
    weatherPoint ? `/api/weather/forecast?lat=${weatherPoint.latitude}&lon=${weatherPoint.longitude}` : null,
    OPEN_METEO_SYNC.pollIntervalMs,
    "Open-Meteo",
    noop,
  );

  // EONET view filters: which ingested events the EONET layer draws (visualization
  // only; separate from layer visibility; session state, not persisted).
  const [eonetFilters, setEonetFilters] = useState<EonetViewFilters>(DEFAULT_EONET_FILTERS);
  // Reference time for the recency window, refreshed hourly (day-scale windows; avoids
  // re-filtering and re-drawing every second).
  const filterReferenceMs = Math.floor(now / 3_600_000) * 3_600_000;
  const eonetSnapshot = eonet.snapshot;
  const eonetInView = useMemo(
    () => (eonetSnapshot ? filterEonet(eonetSnapshot.observations, eonetFilters, filterReferenceMs) : []),
    [eonetSnapshot, eonetFilters, filterReferenceMs],
  );
  const eonetViewIds = useMemo(
    () => new Set(eonetInView.flatMap((o) => (o.entityId ? [o.entityId] : []))),
    [eonetInView],
  );
  const eonetCategoryList = useMemo(
    () => (eonetSnapshot ? eonetCategories(eonetSnapshot.observations) : []),
    [eonetSnapshot],
  );
  // A selected EONET event that left the current view: back to the DISASTERS summary
  // (state adjusted during render, guarded so it runs once).
  if (eonetSnapshot && selectionHiddenByFilters(selectedEntityId, eonetViewIds, EONET_ENTITY_PREFIX)) {
    setPanelTarget({ type: "domain", domain: "disasters" });
  }

  const usgsState = toSyncState(USGS_EARTHQUAKES_SOURCE.id, usgs, USGS_SYNC, now);
  const issState = toSyncState(WTIA_ISS_SOURCE.id, iss, ISS_SYNC, now);
  const kpState = toSyncState(NOAA_SWPC_KP_SOURCE.id, kp, NOAA_KP_SYNC, now);
  const auroraState = toSyncState(NOAA_SWPC_OVATION_SOURCE.id, aurora, NOAA_OVATION_SYNC, now);
  const plasmaState = toSyncState(NOAA_SWPC_RTSW_WIND_SOURCE.id, plasma, NOAA_RTSW_SYNC, now);
  const magState = toSyncState(NOAA_SWPC_RTSW_MAG_SOURCE.id, mag, NOAA_RTSW_SYNC, now);
  const xrayState = toSyncState(NOAA_SWPC_GOES_XRAY_SOURCE.id, xray, NOAA_XRAY_SYNC, now);
  const eonetState = toSyncState(NASA_EONET_SOURCE.id, eonet, NASA_EONET_SYNC, now);
  const weatherState = toSyncState(OPEN_METEO_SOURCE.id, weather, OPEN_METEO_SYNC, now);

  // CLOUDS (NOAA GFS model field): fetched only while the layer is shown; the last
  // field is kept for the session. Health = |now − validAt| of the field on the map
  // (NOAA_GFS_CLOUDS_SYNC); "UPDATED … AGO" = time since the last successful check.
  const clouds = useCloudCover(layerVisibility.clouds, NOAA_GFS_CLOUDS_SYNC.pollIntervalMs);
  const cloudsFeed = clouds.snapshot?.feed ?? null;
  const cloudsState = {
    sourceId: NOAA_GFS_CLOUDS_SOURCE.id,
    health: deriveHealth({
      hasSnapshot: cloudsFeed !== null,
      attempted: clouds.attempted,
      lastAttemptFailed: clouds.lastAttemptFailed,
      snapshotAgeMs: cloudsFeed ? Math.abs(now - Date.parse(cloudsFeed.observation.validAt ?? "")) : null,
      freshnessWindowMs: NOAA_GFS_CLOUDS_SYNC.freshnessWindowMs,
    }),
    lastAttemptAt: clouds.lastAttemptAt,
    lastSuccessAt: clouds.lastSuccessAt,
    lastIngestedAt: cloudsFeed?.metadata.ingestedAt,
    snapshotAgeMs: clouds.lastSuccessAt ? Math.max(0, now - Date.parse(clouds.lastSuccessAt)) : null,
  };
  const cloudGrid = useMemo(
    () =>
      clouds.snapshot
        ? {
            id: clouds.snapshot.feed.grid.id,
            width: clouds.snapshot.feed.grid.width,
            height: clouds.snapshot.feed.grid.height,
            values: clouds.snapshot.values,
            noDataValue: clouds.snapshot.feed.grid.noDataValue,
          }
        : null,
    [clouds.snapshot],
  );

  const sources = [
    { id: USGS_EARTHQUAKES_SOURCE.id, name: USGS_EARTHQUAKES_SOURCE.name, state: usgsState, snapshot: usgs.snapshot },
    { id: WTIA_ISS_SOURCE.id, name: WTIA_ISS_SOURCE.name, state: issState, snapshot: iss.snapshot },
    { id: NOAA_SWPC_KP_SOURCE.id, name: NOAA_SWPC_KP_SOURCE.name, state: kpState, snapshot: kp.snapshot },
    { id: NOAA_SWPC_OVATION_SOURCE.id, name: NOAA_SWPC_OVATION_SOURCE.name, state: auroraState, snapshot: aurora.snapshot },
    { id: NOAA_SWPC_RTSW_WIND_SOURCE.id, name: NOAA_SWPC_RTSW_WIND_SOURCE.name, state: plasmaState, snapshot: plasma.snapshot },
    { id: NOAA_SWPC_RTSW_MAG_SOURCE.id, name: NOAA_SWPC_RTSW_MAG_SOURCE.name, state: magState, snapshot: mag.snapshot },
    { id: NOAA_SWPC_GOES_XRAY_SOURCE.id, name: NOAA_SWPC_GOES_XRAY_SOURCE.name, state: xrayState, snapshot: xray.snapshot },
    { id: NASA_EONET_SOURCE.id, name: NASA_EONET_SOURCE.name, state: eonetState, snapshot: eonet.snapshot },
    // On-demand: only while a weather point exists (no false UNAVAILABLE before any query).
    ...(weatherPoint
      ? [{ id: OPEN_METEO_SOURCE.id, name: OPEN_METEO_SOURCE.name, state: weatherState, snapshot: weather.snapshot }]
      : []),
    // On-demand: only while the cloud layer is shown and a valid field exists.
    ...(layerVisibility.clouds && cloudsFeed
      ? [{ id: NOAA_GFS_CLOUDS_SOURCE.id, name: NOAA_GFS_CLOUDS_SOURCE.name, state: cloudsState, snapshot: cloudsFeed }]
      : []),
  ];
  // Same aggregation for every source; no special rules.
  const globalHealth = aggregateHealth(sources.map((s) => s.state.health));

  const sourceSummary = sources
    .map((s) => `${s.name}: ${s.state.health.toUpperCase()}`)
    .join(" · ");

  useEffect(() => {
    if (!panelTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelTarget]);

  // At most one panel: a domain view, or the selected entity (which belongs to exactly one source).
  let panel: React.ReactNode = null;
  const close = () => setPanelTarget(null);
  if (panelTarget?.type === "domain" && panelTarget.domain === "weather") {
    panel = (
      <WeatherPanel
        point={weatherPoint}
        feed={weather.snapshot}
        health={weatherState.health}
        failed={weather.lastAttemptFailed}
        clouds={{
          visible: layerVisibility.clouds,
          feed: cloudsFeed,
          health: cloudsState.health,
          failed: clouds.lastAttemptFailed,
        }}
        onToggleClouds={() => toggleLayer("clouds")}
        onClose={close}
      />
    );
  } else if (panelTarget?.type === "domain" && panelTarget.domain === "disasters") {
    panel = (
      <DisastersPanel
        earthquakes={usgs.snapshot}
        earthquakesHealth={usgsState.health}
        eonet={eonet.snapshot}
        eonetHealth={eonetState.health}
        layerVisibility={layerVisibility}
        onSetLayers={setLayers}
        eonetFilters={eonetFilters}
        onSetEonetFilters={setEonetFilters}
        eonetInViewCount={eonetInView.length}
        eonetCategories={eonetCategoryList}
        onClose={close}
      />
    );
  } else if (panelTarget?.type === "domain") {
    panel = (
      <SpaceWeatherPanel
        kp={kp.snapshot}
        kpHealth={kpState.health}
        aurora={aurora.snapshot}
        auroraHealth={auroraState.health}
        auroraVisible={layerVisibility.aurora}
        onToggleAurora={() => toggleLayer("aurora")}
        plasma={plasma.snapshot}
        plasmaHealth={plasmaState.health}
        mag={mag.snapshot}
        magHealth={magState.health}
        xray={xray.snapshot}
        xrayHealth={xrayState.health}
        onClose={close}
      />
    );
  } else if (selectedEntityId === ISS_ENTITY_ID && iss.snapshot) {
    const entity = iss.snapshot.entities.find((e) => e.id === selectedEntityId);
    const observation = iss.snapshot.observations.find((o) => o.entityId === selectedEntityId);
    if (entity && observation) {
      panel = (
        <IssPanel
          key={entity.id}
          entity={entity}
          observation={observation}
          trail={{ points: issTrail.length, since: issTrail[0]?.t }}
          source={iss.snapshot.source}
          sourceHealth={issState.health}
          onClose={close}
        />
      );
    }
  } else if (selectedEntityId?.startsWith(EONET_ENTITY_PREFIX) && eonet.snapshot) {
    const entity = eonet.snapshot.entities.find((e) => e.id === selectedEntityId);
    const observation = eonet.snapshot.observations.find((o) => o.entityId === selectedEntityId);
    if (entity && observation) {
      panel = (
        <EonetEventPanel
          key={entity.id}
          entity={entity}
          observation={observation}
          source={eonet.snapshot.source}
          sourceHealth={eonetState.health}
          onHideEonet={() => setLayers({ eonet: false })}
          onClose={close}
        />
      );
    }
  } else if (selectedEntityId && usgs.snapshot) {
    const entity = usgs.snapshot.entities.find((e) => e.id === selectedEntityId);
    const observation = usgs.snapshot.observations.find((o) => o.entityId === selectedEntityId);
    if (entity && observation) {
      panel = (
        <EarthquakePanel
          key={entity.id}
          entity={entity}
          observation={observation}
          source={usgs.snapshot.source}
          sourceHealth={usgsState.health}
          onHideEarthquakes={() => setLayers({ earthquakes: false })}
          onClose={close}
        />
      );
    }
  }

  return (
    <>
      <Topbar health={globalHealth} sourceSummary={sourceSummary} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          activeDomain={panelTarget?.type === "domain" ? panelTarget.domain : null}
          onOpenDomain={(domain) => setPanelTarget({ type: "domain", domain })}
          sources={sources.map((s) => ({
            id: s.id,
            name: s.name,
            health: s.state.health,
            ageMs: s.state.snapshotAgeMs,
          }))}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            earthquakes={usgs.snapshot}
            eonetEvents={eonetInView}
            aurora={aurora.snapshot}
            layerVisibility={layerVisibility}
            iss={iss.snapshot}
            issTrail={issTrailSegments}
            issPositions={issTrail}
            selectedEntityId={panel ? selectedEntityId : null}
            onSelectEntity={selectEntity}
            weatherMode={panelTarget?.type === "domain" && panelTarget.domain === "weather"}
            weatherPoint={weatherPoint}
            onPickWeatherPoint={pickWeatherPoint}
            cloudGrid={cloudGrid}
          />
        </main>
        {panel}
      </div>
      <StatusBar
        sourceCount={sources.filter((s) => s.snapshot !== null).length}
        // Earthquakes, the ISS and EONET events are entities; Kp, aurora, solar wind and X-ray are not.
        entityCount={
          (usgs.snapshot?.entities.length ?? 0) +
          (iss.snapshot?.entities.length ?? 0) +
          (eonet.snapshot?.entities.length ?? 0)
        }
        health={globalHealth}
      />
    </>
  );
}
