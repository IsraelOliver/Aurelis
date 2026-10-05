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
} from "@/lib/map-config";
import { ISS_ENTITY_ID } from "@/lib/sources/wtia/source";
import type { EarthquakeFeed, IssFeed } from "@/types";
import {
  EARTHQUAKES_LAYER_ID,
  addEarthquakeLayer,
  setEarthquakeData,
  setSelectedEarthquake,
} from "./earthquake-layer";
import {
  ISS_INTERACTIVE_LAYERS,
  addIssLayer,
  setIssData,
  setIssSelected,
} from "./iss-layer";

setWorkerUrl(MAPLIBRE_WORKER_URL);

/** Clickable data layers, top-most first (the ISS is drawn above earthquakes). */
const INTERACTIVE_LAYERS = [...ISS_INTERACTIVE_LAYERS, EARTHQUAKES_LAYER_ID];

/**
 * World map. Browser-only: imported through MapView with ssr: false,
 * so maplibre-gl never runs on the server.
 * Created once; data and selection are applied to the existing instance.
 * Container size changes (e.g. the panel opening) are handled by MapLibre's
 * own ResizeObserver (trackResize), which calls map.resize().
 */
export default function WorldMap({
  earthquakes,
  iss,
  selectedEntityId,
  onSelectEntity,
}: {
  earthquakes: EarthquakeFeed | null;
  iss: IssFeed | null;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelectEntity);
  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectEntity;
  }, [onSelectEntity]);

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

    map.on("load", () => {
      addEarthquakeLayer(map);
      addIssLayer(map);

      // One handler for all data layers: the top-most feature wins.
      map.on("click", (event) => {
        const [feature] = map.queryRenderedFeatures(event.point, {
          layers: INTERACTIVE_LAYERS,
        });
        const entityId = feature?.properties?.entityId;
        if (typeof entityId === "string") onSelectRef.current(entityId);
      });
      map.on("mousemove", (event) => {
        const hit = map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS });
        map.getCanvas().style.cursor = hit.length > 0 ? "pointer" : "";
      });

      setStyleReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setEarthquakeData(mapRef.current, earthquakes);
    }
  }, [styleReady, earthquakes]);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setIssData(mapRef.current, iss);
    }
  }, [styleReady, iss]);

  useEffect(() => {
    if (styleReady && mapRef.current) {
      setSelectedEarthquake(mapRef.current, selectedEntityId);
      setIssSelected(mapRef.current, selectedEntityId === ISS_ENTITY_ID);
    }
  }, [styleReady, selectedEntityId]);

  // Sized with h/w-full: MapLibre's CSS forces position: relative on this node.
  return <div ref={containerRef} className="h-full w-full" />;
}
