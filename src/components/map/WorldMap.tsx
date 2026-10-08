"use client";

import { useEffect, useRef, useState } from "react";
import {
  LngLat,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import { publishWeatherAnchor } from "./point-anchor";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BASEMAP_STYLE_URL,
  INITIAL_VIEW,
  MAPLIBRE_WORKER_URL,
  type BasemapMode,
  type ProjectionMode,
} from "@/lib/map-config";
import { fetchEsriImagerySource } from "@/lib/esri-imagery";
import { IMAGERY_SOURCE_ID, addImageryLayer, applyBasemapMode } from "./basemap-layer";
import { ISS_ENTITY_ID } from "@/lib/sources/wtia/source";
import { VISUAL_DELAY_MS, interpolatePosition } from "@/lib/iss-interpolation";
import { orbitTrailStrips, type TrailPoint } from "@/lib/iss-trail";
import type { AirTrafficFeed, AuroraForecastFeed, EarthquakeFeed, EonetEventObservation, IssFeed } from "@/types";
import type { MapLayerVisibility } from "@/lib/map-layers";
import {
  EONET_INTERACTIVE_LAYERS,
  addEonetLayer,
  setEonetData,
  setEonetVisible,
  setSelectedEonet,
} from "./eonet-layer";
import { addAuroraLayer, setAuroraCells, setAuroraVisible } from "./aurora-layer";
import { addWeatherPointLayer, setWeatherPoint } from "./weather-point-layer";
import { addCloudLayer, setCloudGrid, setCloudsVisible, type CloudGrid } from "./cloud-layer";
import {
  addAircraftLayer,
  pickAircraft,
  setAircraftFeed,
  setAircraftVisible,
  setSelectedAircraft,
} from "./aircraft-layer";
import {
  EARTHQUAKES_LAYER_ID,
  addEarthquakeLayer,
  setEarthquakeData,
  setEarthquakesVisible,
  setSelectedEarthquake,
} from "./earthquake-layer";
import {
  ISS_INTERACTIVE_LAYERS,
  ISS_TRAIL_LAYER_ID,
  addIssLayer,
  isIssOrbitTrailActive,
  setIssMarker,
  setIssOrbitTrail,
  setIssProjection,
  setIssSelected,
  setIssTrail,
} from "./iss-layer";

setWorkerUrl(MAPLIBRE_WORKER_URL);

/** Clickable data layers below the aircraft, top-most first: earthquakes, then EONET events. */
const INTERACTIVE_LAYERS = [EARTHQUAKES_LAYER_ID, ...EONET_INTERACTIVE_LAYERS];

/** ISS follow: the zoom the camera flies in to (kept if the user is already closer), and the flight time. */
const ISS_FOLLOW_ZOOM = 4;
const ISS_FOLLOW_FLY_MS = 1400;

/**
 * Camera padding for what covers the map: on compact layouts the context
 * sheet (PanelDock, `[data-sheet]`) lies over the bottom of the map, so a
 * followed entity is centered in the part left visible. On desktop the dock
 * is `display: contents` (the panel sits beside the map): no padding.
 */
function mapInsets(map: MapLibreMap) {
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const sheet = document.querySelector<HTMLElement>("div[data-sheet]");
  const display = sheet ? getComputedStyle(sheet).display : "none";
  if (!sheet || display === "contents" || display === "none") return insets;
  const area = map.getContainer().getBoundingClientRect();
  const covered = area.bottom - sheet.getBoundingClientRect().top;
  insets.bottom = Math.max(0, Math.min(covered, area.height * 0.8));
  return insets;
}

/**
 * Whether the globe hides a location from the camera. Uses MapLibre's own
 * test when the running version exposes it; otherwise a plain geometric
 * check (more than ~85° of arc from the view centre is over the horizon).
 * Always false on the flat map.
 */
function behindGlobe(map: MapLibreMap, lngLat: LngLat): boolean {
  if (map.getProjection()?.type !== "globe") return false;
  const transform = (map as unknown as { transform?: { isLocationOccluded?: (l: LngLat) => boolean } }).transform;
  try {
    if (typeof transform?.isLocationOccluded === "function") return transform.isLocationOccluded(lngLat);
  } catch {
    // Internal API changed or failed: fall through to the geometric check.
  }
  const c = map.getCenter();
  const rad = Math.PI / 180;
  const cos =
    Math.sin(c.lat * rad) * Math.sin(lngLat.lat * rad) +
    Math.cos(c.lat * rad) * Math.cos(lngLat.lat * rad) * Math.cos((lngLat.lng - c.lng) * rad);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad > 85;
}

/**
 * Entity under a screen point, by priority: ISS, aircraft (custom WebGL layer,
 * picked on the CPU), earthquakes, EONET.
 */
function entityAt(map: MapLibreMap, point: { x: number; y: number }): string | null {
  const [iss] = map.queryRenderedFeatures([point.x, point.y], { layers: ISS_INTERACTIVE_LAYERS });
  const issId = iss?.properties?.entityId;
  if (typeof issId === "string") return issId;
  const aircraftId = pickAircraft(map, point.x, point.y);
  if (aircraftId) return aircraftId;
  const [feature] = map.queryRenderedFeatures([point.x, point.y], { layers: INTERACTIVE_LAYERS });
  const id = feature?.properties?.entityId;
  return typeof id === "string" ? id : null;
}

/**
 * World map. Browser-only: imported through MapView with ssr: false,
 * so maplibre-gl never runs on the server.
 * Created once; data and selection are applied to the existing instance.
 * Container size changes (e.g. the panel opening) are handled by MapLibre's
 * own ResizeObserver (trackResize), which calls map.resize().
 */
export default function WorldMap({
  earthquakes,
  eonetEvents,
  aurora,
  layerVisibility,
  iss,
  issTrail,
  issPositions,
  projection,
  basemap,
  onBasemapError,
  selectedEntityId,
  onSelectEntity,
  weatherMode,
  weatherPoint,
  onPickWeatherPoint,
  cloudGrid,
  aircraft,
  aircraftShown,
}: {
  earthquakes: EarthquakeFeed | null;
  /** NASA EONET events in the current view (already filtered; latest geometry drawn). */
  eonetEvents: EonetEventObservation[];
  /** Latest OVATION forecast snapshot (kept while hidden). */
  aurora: AuroraForecastFeed | null;
  /** Which data layers are drawn (rendering/interaction only; data keeps syncing). */
  layerVisibility: MapLayerVisibility;
  iss: IssFeed | null;
  /** Recent tracked path segments (already split at gaps and the antimeridian). */
  issTrail: [number, number][][];
  /** Received ISS positions (the trail points), used only to smooth the marker. */
  issPositions: TrailPoint[];
  projection: ProjectionMode;
  basemap: BasemapMode;
  /** Called when Esri imagery cannot be loaded (the caller falls back to DARK). */
  onBasemapError: () => void;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  /** WEATHER panel open: empty-map clicks pick a point to inspect. */
  weatherMode: boolean;
  /** Point being inspected (drawn only in weather mode). */
  weatherPoint: { latitude: number; longitude: number } | null;
  onPickWeatherPoint: (point: { latitude: number; longitude: number }) => void;
  /** NOAA GFS cloud cover field (kept while hidden), or null before the first load. */
  cloudGrid: CloudGrid | null;
  /** Latest global AIR snapshot and when it was received (kept while paused), or null. */
  aircraft: { feed: AirTrafficFeed; receivedAtMs: number } | null;
  /** AIR active and aircraft shown (otherwise not drawn). */
  aircraftShown: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectEntity);
  const weatherModeRef = useRef(weatherMode);
  const onPickRef = useRef(onPickWeatherPoint);
  const projectionRef = useRef(projection);
  const onBasemapErrorRef = useRef(onBasemapError);
  const [styleReady, setStyleReady] = useState(false);
  const selectedRef = useRef(selectedEntityId);
  /**
   * ISS follow (camera only): "arriving" while flying in, "on" while the
   * camera tracks the displayed (smoothed) ISS position every frame, "off"
   * otherwise. Started by selecting the ISS (or tapping it again while
   * selected); stopped by a user pan or by another selection.
   */
  const followRef = useRef<"off" | "arriving" | "on">("off");
  /** The ISS position currently drawn (written by the animation loop). */
  const issDisplayRef = useRef<{ lon: number; lat: number } | null>(null);
  const startIssFollowRef = useRef<() => void>(() => {});

  useEffect(() => {
    onSelectRef.current = onSelectEntity;
    weatherModeRef.current = weatherMode;
    onPickRef.current = onPickWeatherPoint;
  }, [onSelectEntity, weatherMode, onPickWeatherPoint]);

  useEffect(() => {
    onBasemapErrorRef.current = onBasemapError;
  }, [onBasemapError]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      ...INITIAL_VIEW,
      // Not compact: compact mode collapses the required attribution on first interaction.
      attributionControl: { compact: false },
    });
    mapRef.current = map;

    map.addControl(
      new NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    // Projection and atmosphere are style-level: apply on every style load
    // (no Mercator flash at startup). Very subtle deep-blue atmosphere on the globe.
    map.on("style.load", () => {
      map.setProjection({ type: projectionRef.current });
      const token = (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      map.setSky({
        "sky-color": token("--aurelis-bg"),
        "horizon-color": token("--aurelis-blue"),
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.35, 4, 0.1, 6, 0],
      });
    });

    // Imagery tile failures are logged once; the map and AURELIS layers keep working.
    let imageryErrorLogged = false;
    map.on("error", (event) => {
      if ((event as { sourceId?: string }).sourceId === IMAGERY_SOURCE_ID && !imageryErrorLogged) {
        imageryErrorLogged = true;
        console.warn("[AURELIS] Esri World Imagery tile error:", event.error?.message);
      }
    });

    map.on("load", () => {
      addEarthquakeLayer(map);
      addIssLayer(map);
      addAuroraLayer(map);
      addCloudLayer(map); // directly below the aurora
      addEonetLayer(map);
      addWeatherPointLayer(map);
      // Above earthquakes/EONET, below the ISS (its trail and marker).
      addAircraftLayer(map, map.getLayer(ISS_TRAIL_LAYER_ID) ? ISS_TRAIL_LAYER_ID : undefined);

      // One handler for all data layers: the top-most feature wins. Entities
      // always take priority; only a click on no selectable feature picks a
      // weather point (MapLibre does not fire "click" after a drag or zoom).
      map.on("click", (event) => {
        const entityId = entityAt(map, event.point);
        // Tapping the already-selected ISS again resumes following it (after a pan stopped it).
        if (entityId === ISS_ENTITY_ID && selectedRef.current === ISS_ENTITY_ID) startIssFollowRef.current();
        if (entityId !== null) onSelectRef.current(entityId);
        else if (weatherModeRef.current) {
          // Longitude wrapped to −180..180 (same position on the globe).
          const { lat, lng } = event.lngLat.wrap();
          onPickRef.current({ latitude: lat, longitude: lng });
        }
      });
      map.on("mousemove", (event) => {
        const hit = entityAt(map, event.point) !== null;
        map.getCanvas().style.cursor = hit ? "pointer" : weatherModeRef.current ? "crosshair" : "";
      });
      // A pan by the user hands the camera back (zooming keeps following).
      map.on("dragstart", () => {
        followRef.current = "off";
      });

      setStyleReady(true);
    });

    // Phone: the required attribution can wrap (e.g. with the cloud layer's credit); its real
    // height (--attrib-h on <main>) keeps the map control row just above it, never over it.
    const attrib = containerRef.current.querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
    const host = containerRef.current.closest("main");
    const attribObserver =
      attrib && host
        ? new ResizeObserver(() => host.style.setProperty("--attrib-h", `${attrib.offsetHeight}px`))
        : null;
    if (attrib) attribObserver?.observe(attrib);

    return () => {
      attribObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  // Basemap: imagery is fetched only when SATELLITE is first selected (nothing from Esri in DARK).
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map) return;
    if (basemap === "dark" || map.getSource(IMAGERY_SOURCE_ID)) {
      applyBasemapMode(map, basemap);
      return;
    }
    const controller = new AbortController();
    fetchEsriImagerySource(controller.signal)
      .then((imagery) => {
        addImageryLayer(map, imagery);
        applyBasemapMode(map, "satellite");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[AURELIS] Esri World Imagery unavailable:", error instanceof Error ? error.message : error);
        onBasemapErrorRef.current();
      });
    return () => controller.abort();
  }, [styleReady, basemap]);

  // Switching projection changes only the projection: same map, sources, layers and data.
  useEffect(() => {
    projectionRef.current = projection;
    if (styleReady && mapRef.current) {
      mapRef.current.setProjection({ type: projection });
      setIssProjection(mapRef.current, projection);
    }
  }, [styleReady, projection]);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setEarthquakeData(mapRef.current, earthquakes);
    }
  }, [styleReady, earthquakes]);

  useEffect(() => {
    if (!styleReady || !mapRef.current) return;
    setWeatherPoint(mapRef.current, weatherMode ? weatherPoint : null);
    // Crosshair also without moving the mouse after entering/leaving weather mode.
    mapRef.current.getCanvas().style.cursor = weatherMode ? "crosshair" : "";
  }, [styleReady, weatherMode, weatherPoint]);

  // The Weather point's screen position for the phone popover (point-anchor store),
  // republished on every camera move; nothing while there is no point in weather mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map || !weatherMode || !weatherPoint) {
      publishWeatherAnchor(null);
      return;
    }
    const lngLat = new LngLat(weatherPoint.longitude, weatherPoint.latitude);
    const publish = () => {
      const area = map.getContainer().getBoundingClientRect();
      const p = map.project(lngLat);
      const onScreen = p.x >= 0 && p.y >= 0 && p.x <= area.width && p.y <= area.height;
      publishWeatherAnchor({
        x: Math.round(area.left + p.x),
        y: Math.round(area.top + p.y),
        visible: onScreen && !behindGlobe(map, lngLat),
      });
    };
    publish();
    map.on("move", publish);
    map.on("resize", publish);
    return () => {
      map.off("move", publish);
      map.off("resize", publish);
      publishWeatherAnchor(null);
    };
  }, [styleReady, weatherMode, weatherPoint, projection]);

  // Each AIR snapshot becomes the drawn collection; the layer interpolates visually between
  // real positions (no React per frame, no trails, no extrapolation).
  useEffect(() => {
    if (styleReady && mapRef.current && aircraft) setAircraftFeed(mapRef.current, aircraft.feed, aircraft.receivedAtMs);
  }, [styleReady, aircraft]);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setEonetData(mapRef.current, eonetEvents);
    }
  }, [styleReady, eonetEvents]);

  const {
    earthquakes: earthquakesVisible,
    eonet: eonetVisible,
    aurora: auroraVisible,
    clouds: cloudsVisible,
  } = layerVisibility;
  useEffect(() => {
    if (styleReady && mapRef.current) {
      setEarthquakesVisible(mapRef.current, earthquakesVisible);
      setEonetVisible(mapRef.current, eonetVisible);
      setAircraftVisible(mapRef.current, aircraftShown);
    }
  }, [styleReady, earthquakesVisible, eonetVisible, aircraftShown]);

  // Clouds: a new field is uploaded only when its id changes (atomic texture swap
  // inside a frame); hiding only stops drawing. Projection/basemap changes do not touch it.
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map) return;
    if (cloudsVisible && cloudGrid) setCloudGrid(map, cloudGrid);
    setCloudsVisible(map, cloudsVisible && Boolean(cloudGrid));
  }, [styleReady, cloudGrid, cloudsVisible]);

  // Aurora grid: uploaded only while visible and only when the forecast changes (the
  // layer ignores an already-loaded forecast id). Hiding only stops drawing; the
  // snapshot and the GPU texture stay. MAP/SATELLITE and projection changes do not touch it.
  useEffect(() => {
    const map = mapRef.current;
    if (!styleReady || !map) return;
    const observation = aurora?.observation;
    if (auroraVisible && observation) {
      setAuroraCells(map, observation.id, observation.data.activeCells);
    }
    setAuroraVisible(map, auroraVisible && Boolean(observation));
  }, [styleReady, aurora, auroraVisible]);

  // Latest inputs for the animation loop, read every frame without re-rendering.
  const issEntityRef = useRef<{ id: string; lon: number; lat: number; altitudeKm: number | null } | null>(
    null,
  );
  const issPositionsRef = useRef<TrailPoint[]>([]);
  /** Smallest (client clock − observedAt) seen: maps the source timeline to the client clock. */
  const clockOffsetRef = useRef<number | null>(null);

  useEffect(() => {
    const entity = iss?.entities.find((e) => e.id === ISS_ENTITY_ID);
    const observation = iss?.observations.find((o) => o.entityId === ISS_ENTITY_ID);
    issEntityRef.current = entity?.location
      ? {
          id: entity.id,
          lon: entity.location.longitude,
          lat: entity.location.latitude,
          altitudeKm: observation?.data.altitudeKm ?? null,
        }
      : null;
  }, [iss]);

  useEffect(() => {
    issPositionsRef.current = issPositions;
    const latest = issPositions[issPositions.length - 1];
    if (latest) {
      const offset = Date.now() - latest.t;
      if (clockOffsetRef.current === null || offset < clockOffsetRef.current) {
        clockOffsetRef.current = offset;
      }
    }
  }, [issPositions]);

  /**
   * Visual-only smoothing: one requestAnimationFrame loop moves the ISS marker
   * between received positions, VISUAL_DELAY_MS behind the latest one. Only the
   * ISS source is updated; no React state per frame; cancelled on cleanup (so
   * StrictMode leaves a single loop). Independent of selection.
   */
  useEffect(() => {
    if (!styleReady || !mapRef.current) return;
    const map = mapRef.current;
    let frame = 0;
    let lastKey = "";

    let lastOrbitKey = "";

    const tick = () => {
      const entity = issEntityRef.current;
      const offset = clockOffsetRef.current;
      const displayTime = offset !== null ? Date.now() - offset - VISUAL_DELAY_MS : Infinity;
      let position: { lon: number; lat: number; altitudeKm: number | null } | null = null;
      if (entity) {
        position =
          (offset !== null && interpolatePosition(issPositionsRef.current, displayTime)) ||
          { lon: entity.lon, lat: entity.lat, altitudeKm: entity.altitudeKm };
      }
      const key = position
        ? `${position.lon.toFixed(5)},${position.lat.toFixed(5)},${position.altitudeKm?.toFixed(2)}`
        : "none";
      if (key !== lastKey) {
        lastKey = key;
        setIssMarker(map, entity?.id ?? null, position);
        issDisplayRef.current = position ? { lon: position.lon, lat: position.lat } : null;
        // Following: the camera stays on the marker (same displayTime, so they never drift apart).
        if (followRef.current === "on") {
          if (position) map.jumpTo({ center: [position.lon, position.lat], padding: mapInsets(map) });
          else followRef.current = "off";
        }
      }
      // Globe + selected: the orbital trail ends at the marker, so it follows the same displayTime.
      const orbitKey = isIssOrbitTrailActive(map) ? `${key}|${issPositionsRef.current.length}` : "";
      if (orbitKey && orbitKey !== lastOrbitKey) {
        const display =
          position && position.altitudeKm !== null
            ? { lon: position.lon, lat: position.lat, altitudeKm: position.altitudeKm }
            : null;
        setIssOrbitTrail(map, orbitTrailStrips(issPositionsRef.current, displayTime, display));
      }
      lastOrbitKey = orbitKey;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [styleReady]);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setIssTrail(mapRef.current, issTrail);
    }
  }, [styleReady, issTrail]);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setSelectedEarthquake(mapRef.current, selectedEntityId);
      setSelectedEonet(mapRef.current, selectedEntityId);
      setSelectedAircraft(mapRef.current, selectedEntityId);
      setIssSelected(mapRef.current, selectedEntityId === ISS_ENTITY_ID);
    }
  }, [styleReady, selectedEntityId]);

  // ISS follow: fly in to the displayed position, then hand over to the animation loop.
  useEffect(() => {
    startIssFollowRef.current = () => {
      const map = mapRef.current;
      const target = issDisplayRef.current;
      if (!map || !target) return;
      followRef.current = "arriving";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.flyTo({
        center: [target.lon, target.lat],
        zoom: Math.max(map.getZoom(), ISS_FOLLOW_ZOOM),
        padding: mapInsets(map),
        duration: reduced ? 0 : ISS_FOLLOW_FLY_MS,
        essential: true,
      });
      map.once("moveend", () => {
        if (followRef.current === "arriving") followRef.current = "on";
      });
    };
  }, []);

  useEffect(() => {
    const was = selectedRef.current;
    selectedRef.current = selectedEntityId;
    if (!styleReady) return;
    // After commit: on compact layouts the context sheet is already in the DOM, so the
    // fly-in centers the ISS in the part of the map the sheet leaves visible.
    if (selectedEntityId === ISS_ENTITY_ID && was !== ISS_ENTITY_ID) startIssFollowRef.current();
    else if (selectedEntityId !== ISS_ENTITY_ID) followRef.current = "off";
  }, [styleReady, selectedEntityId]);

  // Sized with h/w-full: MapLibre's CSS forces position: relative on this node.
  return <div ref={containerRef} className="h-full w-full" />;
}
