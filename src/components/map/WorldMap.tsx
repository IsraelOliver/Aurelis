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
import type { EarthquakeFeed } from "@/types";
import {
  EARTHQUAKES_LAYER_ID,
  addEarthquakeLayer,
  setEarthquakeData,
  setSelectedEarthquake,
} from "./earthquake-layer";

setWorkerUrl(MAPLIBRE_WORKER_URL);

/**
 * World map. Browser-only: imported through MapView with ssr: false,
 * so maplibre-gl never runs on the server.
 * Created once; data and selection are applied to the existing instance.
 * Container size changes (e.g. the panel opening) are handled by MapLibre's
 * own ResizeObserver (trackResize), which calls map.resize().
 */
export default function WorldMap({
  earthquakes,
  selectedEntityId,
  onSelectEntity,
}: {
  earthquakes: EarthquakeFeed | null;
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

      map.on("click", EARTHQUAKES_LAYER_ID, (event) => {
        // First feature is the top-most rendered one.
        const entityId = event.features?.[0]?.properties?.entityId;
        if (typeof entityId === "string") onSelectRef.current(entityId);
      });
      map.on("mouseenter", EARTHQUAKES_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", EARTHQUAKES_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
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
      setSelectedEarthquake(mapRef.current, selectedEntityId);
    }
  }, [styleReady, selectedEntityId]);

  // Sized with h/w-full: MapLibre's CSS forces position: relative on this node.
  return <div ref={containerRef} className="h-full w-full" />;
}
