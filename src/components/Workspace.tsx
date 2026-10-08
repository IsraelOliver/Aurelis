"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AirTrafficFeed,
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
  OPENSKY_SYNC,
  USGS_SYNC,
  aggregateHealth,
  deriveHealth,
  type SyncConfig,
} from "@/lib/source-health";
import { USGS_EARTHQUAKES_SOURCE } from "@/lib/sources/usgs/source";
import { ISS_ENTITY_ID, WTIA_ISS_SOURCE } from "@/lib/sources/wtia/source";
import { EONET_ENTITY_PREFIX, NASA_EONET_SOURCE } from "@/lib/sources/nasa/eonet-source";
import { OPEN_METEO_SOURCE } from "@/lib/sources/open-meteo/source";
import { AIRCRAFT_ENTITY_PREFIX, OPENSKY_AIRCRAFT_SOURCE } from "@/lib/sources/opensky/source";
import { ROW, rowToAircraft } from "@/lib/sources/opensky/rows";
import { isAirActive } from "@/lib/air-policy";
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
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import StatusBar, { StatusSummary } from "@/components/layout/StatusBar";
import MobileDrawer from "@/components/layout/MobileDrawer";
import SettingsModal from "@/components/layout/SettingsModal";
import MobileShell from "@/components/mobile/MobileShell";
import MobileDomainControls from "@/components/mobile/MobileDomainControls";
import WeatherInspector from "@/components/mobile/WeatherInspector";
import type { MobileTab } from "@/components/mobile/MobileTabBar";
import PanelDock from "@/components/panel/PanelDock";
import SmileyDock from "@/components/panel/SmileyDock";
import { DEFAULT_SHEET_SIZE, PHONE_SHEET_HEIGHT, SHEET_HEIGHT, type SheetSize } from "@/lib/sheet";
import MapView from "@/components/map/MapView";
import EarthquakePanel from "@/components/panel/EarthquakePanel";
import EonetEventPanel from "@/components/panel/EonetEventPanel";
import DisastersPanel from "@/components/panel/DisastersPanel";
import WeatherPanel from "@/components/panel/WeatherPanel";
import AirPanel from "@/components/panel/AirPanel";
import AircraftPanel from "@/components/panel/AircraftPanel";
import IssPanel from "@/components/panel/IssPanel";
import SpaceWeatherPanel from "@/components/panel/SpaceWeatherPanel";
import AiPanel from "@/components/panel/AiPanel";
import { useAiChat } from "./useAiChat";
import { useThemeSync } from "./useTheme";
import { buildSmileyContext, type SmileyContextInput } from "@/lib/ai/context";
import { focusCapsule, focusKindOf } from "@/lib/ai/capsules";
import { routeQuestion } from "@/lib/ai/router";
import type { AiDomain } from "@/lib/ai/types";
import { useSourceSync, type SourceSync } from "./useSourceSync";
import { useCloudCover } from "./useCloudCover";
import { useAirTraffic } from "./useAirTraffic";
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
export type DomainId = "space" | "disasters" | "weather" | "air";

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
  // SMILEY: its own right-panel view over the current selection (which it keeps as FOCUS).
  const [aiOpen, setAiOpen] = useState(false);
  const aiChat = useAiChat();
  // Desktop theme (Settings › Themes): follows changes made in another tab.
  useThemeSync();
  // Compact layout (below lg) only: navigation drawer and bottom-sheet height. Pure UI state.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Desktop only: the Settings window (opened from the toolbar).
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Phone app shell only: the SETTINGS tab (MAP and SMILEY derive from aiOpen). Pure UI state.
  const [phoneSettings, setPhoneSettings] = useState(false);
  // SMILEY's unsent text, kept here so leaving the SMILEY tab does not lose it.
  const [aiDraft, setAiDraft] = useState("");
  const [sheetSize, setSheetSize] = useState<SheetSize>("medium");
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
  /** Per layer: which selected entities it owns and the domain summary to return to when it is hidden. */
  const selectionOwner: Partial<Record<MapLayerId, { owns: (entityId: string) => boolean; domain: DomainId }>> = {
    earthquakes: { owns: (id) => id.startsWith("earthquake:"), domain: "disasters" },
    eonet: { owns: (id) => id.startsWith(EONET_ENTITY_PREFIX), domain: "disasters" },
    aircraft: { owns: (id) => id.startsWith(AIRCRAFT_ENTITY_PREFIX), domain: "air" },
  };
  const setLayers = (next: Partial<MapLayerVisibility>) => {
    const hidden = (Object.keys(next) as MapLayerId[]).filter((id) => next[id] === false);
    const owner = hidden.map((id) => selectionOwner[id]).find(
      (o) => o && panelTarget?.type === "entity" && o.owns(panelTarget.entityId),
    );
    // A selected entity that is no longer drawn: back to its domain summary.
    if (owner) setPanelTarget({ type: "domain", domain: owner.domain });
    // Functional merge: never overwrite other layers with a stale render's values.
    setLayerVisibility((prev) => ({ ...prev, ...next }));
  };
  const toggleLayer = (id: MapLayerId) => setLayers({ [id]: !layerVisibility[id] });
  const now = useNow(1000);

  // WEATHER (Open-Meteo, query-scoped): the point chosen on the map; session state only.
  // No point = no query, no polling, and the source is not listed or counted.
  const [weatherPoint, setWeatherPoint] = useState<WeatherPoint | null>(null);
  // Phone only: the Weather popover over the map (open after a pick, closed by × or leaving
  // Weather; the point is kept) and the full Weather sheet as an optional detailed view.
  const [weatherPopover, setWeatherPopover] = useState(false);
  const [weatherDetails, setWeatherDetails] = useState(false);
  const pickWeatherPoint = useCallback((p: WeatherPoint) => {
    setWeatherPoint({ latitude: round5(p.latitude), longitude: round5(p.longitude) });
    setWeatherPopover(true);
    setWeatherDetails(false);
  }, []);
  // AIR (OpenSky, GLOBAL): one /states/all snapshot, refreshed only while AIR is active —
  // AIR panel or a selected aircraft open, and aircraft shown. Elsewhere (or hidden) polling
  // pauses to save quota; the last snapshot is kept and shown again at once on return.
  const airDomainOpen =
    (panelTarget?.type === "domain" && panelTarget.domain === "air") ||
    (panelTarget?.type === "entity" && panelTarget.entityId.startsWith(AIRCRAFT_ENTITY_PREFIX));
  const airActive = isAirActive(airDomainOpen, layerVisibility.aircraft);
  const onAirSnapshot = useCallback((feed: AirTrafficFeed) => {
    // A selected aircraft absent from the new snapshot: back to the AIR summary (no claim about why).
    setPanelTarget((target) => {
      if (target?.type !== "entity" || !target.entityId.startsWith(AIRCRAFT_ENTITY_PREFIX)) return target;
      const icao24 = target.entityId.slice(AIRCRAFT_ENTITY_PREFIX.length);
      return feed.aircraft.some((row) => row[ROW.icao24] === icao24) ? target : { type: "domain", domain: "air" };
    });
  }, []);
  const air = useAirTraffic(airActive, onAirSnapshot);
  const firstAirOpen = useRef(true);
  const openDomain = (domain: DomainId) => {
    // First AIR visit of the session: aircraft are shown (then HIDE/SHOW is the user's).
    if (domain === "air" && firstAirOpen.current) {
      firstAirOpen.current = false;
      setLayerVisibility((v) => ({ ...v, aircraft: true }));
    }
    setAiOpen(false);
    setPanelTarget({ type: "domain", domain });
  };

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
  // Paused polling is not staleness: health is only evaluated while AIR is active, and a
  // cached snapshot waits for the first refresh of this activation ("syncing").
  const airAgeMs = air.snapshot ? Math.max(0, now - Date.parse(air.snapshot.metadata.ingestedAt)) : null;
  const airState = {
    sourceId: OPENSKY_AIRCRAFT_SOURCE.id,
    health:
      air.snapshot && !air.refreshedSinceActivation && !air.lastAttemptFailed
        ? ("syncing" as const)
        : deriveHealth({
            hasSnapshot: air.snapshot !== null,
            attempted: air.attempted,
            lastAttemptFailed: air.lastAttemptFailed,
            snapshotAgeMs: airAgeMs,
            freshnessWindowMs: OPENSKY_SYNC.freshnessWindowMs,
          }),
    lastAttemptAt: air.lastAttemptAt,
    lastSuccessAt: air.lastSuccessAt,
    lastIngestedAt: air.snapshot?.metadata.ingestedAt,
    snapshotAgeMs: airAgeMs,
  };
  const airLayerData = useMemo(
    () => (air.snapshot && air.receivedAtMs !== null ? { feed: air.snapshot, receivedAtMs: air.receivedAtMs } : null),
    [air.snapshot, air.receivedAtMs],
  );

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
    // Active-domain: only while AIR is active (paused polling is neither listed nor counted).
    ...(airActive
      ? [{ id: OPENSKY_AIRCRAFT_SOURCE.id, name: OPENSKY_AIRCRAFT_SOURCE.name, state: airState, snapshot: air.snapshot }]
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
    if (!panelTarget && !aiOpen && !drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The drawer closes first, then SMILEY (back to the panel under it), then the panel.
      if (drawerOpen) setDrawerOpen(false);
      else if (aiOpen) setAiOpen(false);
      else setPanelTarget(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelTarget, aiOpen, drawerOpen]);

  // At most one panel: a domain view, or the selected entity (which belongs to exactly one source).
  let panel: React.ReactNode = null;
  const close = () => setPanelTarget(null);
  const weatherDomain = panelTarget?.type === "domain" && panelTarget.domain === "weather";
  // Leaving Weather closes its phone popover and detailed view (the point stays).
  // Adjusted during render (React's pattern for derived resets).
  const [weatherDomainSeen, setWeatherDomainSeen] = useState(false);
  if (weatherDomain !== weatherDomainSeen) {
    setWeatherDomainSeen(weatherDomain);
    if (!weatherDomain) {
      setWeatherPopover(false);
      setWeatherDetails(false);
    }
  }
  // Phone: Weather starts on the map (no sheet) unless its detailed view was asked for.
  const phoneSheetHidden = weatherDomain && !weatherDetails;
  if (weatherDomain) {
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
        onClose={
          weatherDetails
            ? () => {
                // Back to the map (and the popover); the hidden sheet drops back to its default height.
                setWeatherDetails(false);
                setSheetSize(DEFAULT_SHEET_SIZE);
              }
            : close
        }
      />
    );
  } else if (panelTarget?.type === "domain" && panelTarget.domain === "air") {
    panel = (
      <AirPanel
        feed={air.snapshot}
        health={airState.health}
        failed={air.lastAttemptFailed}
        refreshing={air.snapshot !== null && !air.refreshedSinceActivation && layerVisibility.aircraft}
        aircraftVisible={layerVisibility.aircraft}
        quotaLow={air.quotaLow}
        onToggleAircraft={() => toggleLayer("aircraft")}
        onRefreshOnce={air.refreshOnce}
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
  } else if (selectedEntityId?.startsWith(AIRCRAFT_ENTITY_PREFIX) && air.snapshot) {
    // The panel always shows the latest REAL state (never the interpolated map position).
    const icao24 = selectedEntityId.slice(AIRCRAFT_ENTITY_PREFIX.length);
    const row = air.snapshot.aircraft.find((r) => r[ROW.icao24] === icao24);
    const aircraft = row && rowToAircraft(row, air.snapshot.metadata.stateTime, air.snapshot.metadata.ingestedAt);
    if (aircraft) {
      const { entity, observation } = aircraft;
      panel = (
        <AircraftPanel
          key={entity.id}
          entity={entity}
          observation={observation}
          source={air.snapshot.source}
          sourceHealth={airState.health}
          onHideAircraft={() => setLayers({ aircraft: false })}
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

  // SMILEY: the question is routed and its context built only when it is sent, from what this
  // shell already holds (router + capsules + budget; nothing is sent that the route does not need).
  const aiData = {
    iss: iss.snapshot,
    kp: kp.snapshot,
    plasma: plasma.snapshot,
    mag: mag.snapshot,
    xray: xray.snapshot,
    aurora: aurora.snapshot,
    earthquakes: usgs.snapshot,
    eonet: eonet.snapshot,
    eonetInView,
    eonetFilters,
    weather: weatherPoint ? weather.snapshot : null,
    clouds: { shown: layerVisibility.clouds, feed: cloudsFeed },
    air: { pollingActive: airActive, shown: layerVisibility.aircraft, quotaLow: air.quotaLow, feed: air.snapshot },
  };
  // Only a selection that has a panel (i.e. still exists in its source) can be the focus.
  const aiFocusId = panel ? selectedEntityId : null;
  const prepareAiRequest = (question: string, nowMs: number) => {
    const route = routeQuestion(question, {
      focusKind: focusKindOf(aiFocusId, aiData),
      openPanel: panelTarget?.type === "domain" ? panelTarget.domain : panelTarget ? "entity" : null,
    });
    const input: SmileyContextInput = {
      ...aiData,
      nowMs,
      selectedEntityId: aiFocusId,
      sources: sources.map((s) => ({ id: s.id, name: s.name, health: s.state.health, snapshotAgeMs: s.state.snapshotAgeMs })),
    };
    return { route, built: buildSmileyContext(input, route) };
  };
  const aiAvailable: AiDomain[] = [
    ...(iss.snapshot || kp.snapshot || plasma.snapshot || mag.snapshot || xray.snapshot || aurora.snapshot ? ["space" as const] : []),
    ...(usgs.snapshot || eonet.snapshot ? ["disasters" as const] : []),
    ...(aiData.weather || cloudsFeed ? ["weather" as const] : []),
    ...(air.snapshot ? ["air" as const] : []),
  ];
  // A different data panel in the sheet → default height; collapsing keeps the selection.
  // SMILEY (full screen below lg) does not count: closing it returns the sheet exactly as it was.
  // Adjusted during render (React's pattern for derived resets).
  const sheetKey = panelTarget ? (panelTarget.type === "domain" ? panelTarget.domain : panelTarget.entityId) : null;
  const [sheetKeySeen, setSheetKeySeen] = useState<string | null>(null);
  if (sheetKey !== sheetKeySeen) {
    setSheetKeySeen(sheetKey);
    if (sheetKey) setSheetSize(DEFAULT_SHEET_SIZE);
  }
  const sidebarSources = sources.map((s) => ({
    id: s.id,
    name: s.name,
    health: s.state.health,
    ageMs: s.state.snapshotAgeMs,
  }));
  // Earthquakes, the ISS, EONET events and the aircraft of the active global AIR snapshot
  // (only while AIR is active) are entities; Kp, aurora, solar wind, X-ray and clouds are not.
  const entityCount =
    (usgs.snapshot?.entities.length ?? 0) +
    (iss.snapshot?.entities.length ?? 0) +
    (eonet.snapshot?.entities.length ?? 0) +
    (airActive ? (air.snapshot?.aircraft.length ?? 0) : 0);
  const sourceCount = sources.filter((s) => s.snapshot !== null).length;
  const activeDomain = !aiOpen && panelTarget?.type === "domain" ? panelTarget.domain : null;

  const rightPanel = aiOpen ? (
    <AiPanel
      chat={aiChat}
      domains={aiAvailable}
      focusLabel={aiOpen ? (focusCapsule(aiFocusId, aiData, true)?.label ?? null) : null}
      prepare={prepareAiRequest}
      onClose={() => setAiOpen(false)}
      draft={aiDraft}
      onDraftChange={setAiDraft}
    />
  ) : (
    panel
  );

  // Phone app shell: MAP · SMILEY · SETTINGS over the same state (the map never unmounts).
  const mobileTab: MobileTab = phoneSettings ? "settings" : aiOpen ? "smiley" : "map";
  const onMobileTab = (tab: MobileTab) => {
    setPhoneSettings(tab === "settings");
    setAiOpen(tab === "smiley");
  };
  // Live figures for the phone Domains sheet: what the map shows (EONET within the current filters).
  const domainCounts = {
    ...(usgs.snapshot || eonet.snapshot
      ? { disasters: ((usgs.snapshot?.entities.length ?? 0) + eonetViewIds.size).toLocaleString("en-US") }
      : {}),
    ...(airActive && air.snapshot ? { air: air.snapshot.aircraft.length.toLocaleString("en-US") } : {}),
  };

  return (
    <>
      {/* Desktop and tablet toolbar; phones use the floating map header of the mobile shell. */}
      <div className="contents phone:hidden">
        <Topbar
          health={globalHealth}
          sourceSummary={sourceSummary}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>
      {/* Desktop: sidebar is part of the window; the map is a raised canvas; panels float beside it. */}
      <div className="flex min-h-0 flex-1 lg:gap-3 lg:pb-3 lg:pr-3">
        <DesktopSidebar
          activeDomain={activeDomain}
          onOpenDomain={openDomain}
          aiOpen={aiOpen}
          onToggleAi={() => setAiOpen((open) => !open)}
          sources={sidebarSources}
          status={(collapsed) => (
            <StatusBar sourceCount={sourceCount} entityCount={entityCount} health={globalHealth} collapsed={collapsed} />
          )}
        />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Sidebar
            variant="drawer"
            activeDomain={activeDomain}
            onOpenDomain={(domain) => {
              setDrawerOpen(false);
              openDomain(domain);
            }}
            aiOpen={aiOpen}
            onToggleAi={() => {
              setDrawerOpen(false);
              setAiOpen(true);
            }}
            sources={sidebarSources}
            status={<StatusSummary sourceCount={sourceCount} entityCount={entityCount} health={globalHealth} />}
            onClose={() => setDrawerOpen(false)}
          />
        </MobileDrawer>
        {/* --sheet-offset: how much of the map the compact bottom sheet covers (map controls sit above it);
            --sheet-offset-phone: the same on phones, above the tab bar. */}
        <main
          className="aurelis-map-plate relative min-w-0 flex-1 lg:isolate lg:overflow-hidden lg:rounded-window lg:border lg:border-hairline-strong lg:bg-map lg:shadow-plate"
          data-sheet={panel && !aiOpen ? sheetSize : "none"}
          data-domain-controls={weatherDomain && !aiOpen && !weatherDetails ? "weather" : undefined}
          data-inspect={weatherDomain && !aiOpen && !(weatherPoint && weatherPopover) ? "weather" : undefined}
          style={
            {
              "--sheet-offset": panel && !aiOpen ? SHEET_HEIGHT[sheetSize] : "env(safe-area-inset-bottom)",
              "--sheet-offset-phone":
                panel && !aiOpen && !phoneSheetHidden
                  ? `calc(${PHONE_SHEET_HEIGHT[sheetSize]} + var(--tabbar-space))`
                  : "var(--tabbar-space)",
            } as React.CSSProperties
          }
        >
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
            aircraft={airLayerData}
            aircraftShown={airActive}
          />
          {/* Phone: domain-specific map controls (Weather → Clouds). */}
          {weatherDomain && !aiOpen && !weatherDetails && (
            <MobileDomainControls
              domain="weather"
              clouds={{ on: layerVisibility.clouds, onToggle: () => toggleLayer("clouds") }}
            />
          )}
        </main>
        {/* Below lg: SMILEY full screen; data panels in the bottom sheet. lg+: both are the side panel. */}
        {aiOpen ? (
          <SmileyDock>{rightPanel}</SmileyDock>
        ) : (
          rightPanel && (
            <PanelDock size={sheetSize} onSize={setSheetSize} phoneHidden={phoneSheetHidden}>
              {rightPanel}
            </PanelDock>
          )
        )}
      </div>
      {/* Desktop Settings window (appearance): an overlay; nothing below it changes or unmounts. */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {/* Phone: Weather inspection (instruction, then the point's popover) over the map. */}
      {weatherDomain && !aiOpen && !phoneSettings && !weatherDetails && (
        <WeatherInspector
          point={weatherPoint}
          feed={weather.snapshot}
          failed={weather.lastAttemptFailed && !weather.snapshot}
          popoverOpen={weatherPopover}
          onClose={() => setWeatherPopover(false)}
          onRetry={weather.retry}
          onDetails={() => {
            setWeatherDetails(true);
            setSheetSize("expanded");
          }}
        />
      )}
      {/* Phone app shell (Tailwind `phone`): tab bar, map header, Domains / Sources sheets, Settings screen. */}
      <MobileShell
        tab={mobileTab}
        onTab={onMobileTab}
        health={globalHealth}
        sources={sidebarSources}
        sourceCount={sourceCount}
        entityCount={entityCount}
        activeDomain={panelTarget?.type === "domain" ? panelTarget.domain : null}
        domainCounts={domainCounts}
        onWorld={() => setPanelTarget(null)}
        onDomain={openDomain}
      />
    </>
  );
}
