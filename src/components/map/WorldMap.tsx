"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
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
import type { AuroraForecastFeed, EarthquakeFeed, EonetEventObservation, IssFeed } from "@/types";
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
  EARTHQUAKES_LAYER_ID,
  addEarthquakeLayer,
  setEarthquakeData,
  setEarthquakesVisible,
  setSelectedEarthquake,
} from "./earthquake-layer";
import {
  ISS_INTERACTIVE_LAYERS,
  addIssLayer,
  isIssOrbitTrailActive,
  setIssMarker,
  setIssOrbitTrail,
  setIssProjection,
  setIssSelected,
  setIssTrail,
} from "./iss-layer";

setWorkerUrl(MAPLIBRE_WORKER_URL);

/** Clickable data layers, top-most first: ISS, earthquakes, then EONET events. */
const INTERACTIVE_LAYERS = [...ISS_INTERACTIVE_LAYERS, EARTHQUAKES_LAYER_ID, ...EONET_INTERACTIVE_LAYERS];

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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectEntity);
  const weatherModeRef = useRef(weatherMode);
  const onPickRef = useRef(onPickWeatherPoint);
  const projectionRef = useRef(projection);
  const onBasemapErrorRef = useRef(onBasemapError);
  const [styleReady, setStyleReady] = useState(false);

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

      // One handler for all data layers: the top-most feature wins. Entities
      // always take priority; only a click on no selectable feature picks a
      // weather point (MapLibre does not fire "click" after a drag or zoom).
      map.on("click", (event) => {
        const [feature] = map.queryRenderedFeatures(event.point, {
          layers: INTERACTIVE_LAYERS,
        });
        const entityId = feature?.properties?.entityId;
        if (typeof entityId === "string") onSelectRef.current(entityId);
        else if (weatherModeRef.current) {
          // Longitude wrapped to −180..180 (same position on the globe).
          const { lat, lng } = event.lngLat.wrap();
          onPickRef.current({ latitude: lat, longitude: lng });
        }
      });
      map.on("mousemove", (event) => {
        const hit = map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS });
        map.getCanvas().style.cursor = hit.length > 0 ? "pointer" : weatherModeRef.current ? "crosshair" : "";
      });

      setStyleReady(true);
    });

    return () => {
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
    }
  }, [styleReady, earthquakesVisible, eonetVisible]);

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
      setIssSelected(mapRef.current, selectedEntityId === ISS_ENTITY_ID);
    }
  }, [styleReady, selectedEntityId]);

  // Sized with h/w-full: MapLibre's CSS forces position: relative on this node.
  return <div ref={containerRef} className="h-full w-full" />;
}
