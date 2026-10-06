import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { EarthquakeFeed } from "@/types";

/**
 * Map representation of the earthquake feed: a GeoJSON source + circle layer,
 * on top of the basemap. Only AURELIS domain objects reach this module.
 */
export const EARTHQUAKES_SOURCE_ID = "aurelis-earthquakes-source";
export const EARTHQUAKES_LAYER_ID = "aurelis-earthquakes-layer";
/** Same source, filtered to the selected entity; drawn above all other earthquakes. */
export const EARTHQUAKES_SELECTED_LAYER_ID = "aurelis-earthquakes-selected-layer";

const NONE_SELECTED: ExpressionSpecification = ["==", ["get", "entityId"], ""];

interface EarthquakeFeatureProps {
  entityId: string;
  magnitude: number | null;
}

/** Reads a palette token so map colors come from globals.css, not hex here. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function addEarthquakeLayer(map: MapLibreMap): void {
  map.addSource(EARTHQUAKES_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const magnitude: ExpressionSpecification = ["coalesce", ["get", "magnitude"], 0];
  // Qualitative encoding: circle size encodes magnitude. Not proportional to energy.
  const radius: ExpressionSpecification = [
    "interpolate", ["linear"], magnitude,
    2.5, 3,
    4.5, 6,
    6.5, 11,
    8, 16,
  ];

  map.addLayer({
    id: EARTHQUAKES_LAYER_ID,
    type: "circle",
    source: EARTHQUAKES_SOURCE_ID,
    layout: {
      // Larger magnitudes drawn on top.
      "circle-sort-key": magnitude,
    },
    paint: {
      "circle-radius": radius,
      "circle-color": token("--aurelis-cyan"),
      "circle-opacity": 0.55,
      "circle-stroke-color": token("--aurelis-bg"),
      "circle-stroke-width": 1,
    },
  });

  // Selection highlight: gold is reserved for the selected entity.
  map.addLayer({
    id: EARTHQUAKES_SELECTED_LAYER_ID,
    type: "circle",
    source: EARTHQUAKES_SOURCE_ID,
    filter: NONE_SELECTED,
    paint: {
      "circle-radius": ["+", radius, 2],
      "circle-color": token("--aurelis-gold"),
      "circle-opacity": 0.95,
      "circle-stroke-color": token("--aurelis-bg"),
      "circle-stroke-width": 1.5,
    },
  });
}

export function setSelectedEarthquake(
  map: MapLibreMap,
  entityId: string | null,
): void {
  map.setFilter(
    EARTHQUAKES_SELECTED_LAYER_ID,
    entityId ? ["==", ["get", "entityId"], entityId] : NONE_SELECTED,
  );
}

export function setEarthquakeData(
  map: MapLibreMap,
  feed: EarthquakeFeed | null,
): void {
  const magnitudeByEntity = new Map(
    (feed?.observations ?? []).map((o) => [o.entityId, o.data.magnitude]),
  );

  const data: FeatureCollection<Point, EarthquakeFeatureProps> = {
    type: "FeatureCollection",
    features: (feed?.entities ?? []).flatMap((entity) =>
      entity.location
        ? [
            {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [entity.location.longitude, entity.location.latitude],
              },
              properties: {
                entityId: entity.id,
                magnitude: magnitudeByEntity.get(entity.id) ?? null,
              },
            },
          ]
        : [],
    ),
  };

  map.getSource<GeoJSONSource>(EARTHQUAKES_SOURCE_ID)?.setData(data);
}

/** Shows or hides the earthquake layers, selection included (visibility only; data is kept). */
export function setEarthquakesVisible(map: MapLibreMap, visible: boolean): void {
  for (const id of [EARTHQUAKES_LAYER_ID, EARTHQUAKES_SELECTED_LAYER_ID]) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}
