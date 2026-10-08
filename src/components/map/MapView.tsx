"use client";

import type { CloudGrid } from "./cloud-layer";
import type { AirTrafficFeed } from "@/types";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { AuroraForecastFeed, EarthquakeFeed, EonetEventObservation, IssFeed } from "@/types";
import type { MapLayerVisibility } from "@/lib/map-layers";
import type { TrailPoint } from "@/lib/iss-trail";
import {
  DEFAULT_BASEMAP,
  DEFAULT_PROJECTION,
  type BasemapMode,
  type ProjectionMode,
} from "@/lib/map-config";
import { ARCGIS_API_KEY } from "@/lib/esri-imagery";
import SegmentedControl from "./SegmentedControl";

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-[10px] tracking-[0.24em] text-fg-subtle">
      LOADING MAP
    </div>
  ),
});

export default function MapView({
  earthquakes,
  eonetEvents,
  aurora,
  layerVisibility,
  iss,
  issTrail,
  issPositions,
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
  eonetEvents: EonetEventObservation[];
  aurora: AuroraForecastFeed | null;
  layerVisibility: MapLayerVisibility;
  iss: IssFeed | null;
  issTrail: [number, number][][];
  issPositions: TrailPoint[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
  weatherMode: boolean;
  weatherPoint: { latitude: number; longitude: number } | null;
  onPickWeatherPoint: (point: { latitude: number; longitude: number }) => void;
  cloudGrid: CloudGrid | null;
  aircraft: { feed: AirTrafficFeed; receivedAtMs: number } | null;
  aircraftShown: boolean;
}) {
  // Two independent session states (not persisted): projection and basemap.
  const [projection, setProjection] = useState<ProjectionMode>(DEFAULT_PROJECTION);
  const [basemap, setBasemap] = useState<BasemapMode>(DEFAULT_BASEMAP);
  const [imageryFailed, setImageryFailed] = useState(false);

  // Imagery could not be loaded: fall back to the AURELIS dark basemap.
  const onBasemapError = useCallback(() => {
    setImageryFailed(true);
    setBasemap("dark");
  }, []);

  const satelliteTitle = !ARCGIS_API_KEY
    ? "ArcGIS API key not configured"
    : imageryFailed
      ? "Esri World Imagery could not be loaded; try again"
      : "Esri World Imagery";

  return (
    <div
      className={`relative h-full w-full bg-map ${basemap === "satellite" ? "aurelis-basemap-satellite" : ""}`}
    >
      <WorldMap
        earthquakes={earthquakes}
        eonetEvents={eonetEvents}
        aurora={aurora}
        layerVisibility={layerVisibility}
        iss={iss}
        issTrail={issTrail}
        issPositions={issPositions}
        projection={projection}
        basemap={basemap}
        onBasemapError={onBasemapError}
        selectedEntityId={selectedEntityId}
        onSelectEntity={onSelectEntity}
        weatherMode={weatherMode}
        weatherPoint={weatherPoint}
        onPickWeatherPoint={onPickWeatherPoint}
        cloudGrid={cloudGrid}
        aircraft={aircraft}
        aircraftShown={aircraftShown}
      />
      <div className="aurelis-map-controls absolute bottom-3 left-3 z-10 flex flex-wrap items-end gap-2 transition-[bottom] duration-200 lg:bottom-5 lg:left-5 lg:gap-2.5 max-lg:bottom-[calc(var(--sheet-offset,0px)+0.75rem)] max-lg:left-[max(0.75rem,env(safe-area-inset-left))] max-lg:max-w-[calc(100%-5rem)] phone:bottom-[calc(var(--sheet-offset-phone,0px)+var(--attrib-h,1.25rem)+0.5rem)] phone:flex-nowrap phone:gap-1 phone:rounded-full phone:border phone:border-glass-line phone:bg-glass phone:p-1 phone:shadow-mobile phone:backdrop-blur-xl phone:backdrop-saturate-150">
        <SegmentedControl
          label="Map projection"
          value={projection}
          onChange={setProjection}
          options={[
            { value: "globe", label: "GLOBE" },
            { value: "mercator", label: "FLAT" },
          ]}
        />
        <SegmentedControl
          label="Basemap"
          value={basemap}
          onChange={(mode) => {
            setImageryFailed(false);
            setBasemap(mode);
          }}
          options={[
            { value: "dark", label: "MAP", title: "AURELIS map (OpenFreeMap)" },
            {
              value: "satellite",
              label: "SATELLITE",
              disabled: !ARCGIS_API_KEY,
              title: satelliteTitle,
            },
          ]}
        />
      </div>
    </div>
  );
}
