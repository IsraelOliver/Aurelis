"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { EarthquakeFeed, IssFeed } from "@/types";
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
  iss,
  issTrail,
  issPositions,
  selectedEntityId,
  onSelectEntity,
}: {
  earthquakes: EarthquakeFeed | null;
  iss: IssFeed | null;
  issTrail: [number, number][][];
  issPositions: TrailPoint[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
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
      className={`relative h-full w-full bg-base ${basemap === "satellite" ? "aurelis-basemap-satellite" : ""}`}
    >
      <WorldMap
        earthquakes={earthquakes}
        iss={iss}
        issTrail={issTrail}
        issPositions={issPositions}
        projection={projection}
        basemap={basemap}
        onBasemapError={onBasemapError}
        selectedEntityId={selectedEntityId}
        onSelectEntity={onSelectEntity}
      />
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
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
