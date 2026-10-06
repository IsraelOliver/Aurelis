import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

/**
 * The WEATHER query point: only a marker of the coordinate being inspected
 * (gold target ring, the current selection). Not an Entity, not a dataset
 * layer, no Observation of its own; not clickable. Shown only while the
 * WEATHER panel is open.
 */
export const WEATHER_POINT_SOURCE_ID = "aurelis-weather-point-source";
export const WEATHER_POINT_LAYER_ID = "aurelis-weather-point-layer";

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function addWeatherPointLayer(map: MapLibreMap): void {
  map.addSource(WEATHER_POINT_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: WEATHER_POINT_LAYER_ID,
    type: "circle",
    source: WEATHER_POINT_SOURCE_ID,
    paint: {
      "circle-radius": 7,
      "circle-opacity": 0,
      "circle-stroke-color": token("--aurelis-gold"),
      "circle-stroke-width": 1.5,
    },
  });
}

/** Draws the point, or nothing (null). */
export function setWeatherPoint(map: MapLibreMap, point: { latitude: number; longitude: number } | null): void {
  map.getSource<GeoJSONSource>(WEATHER_POINT_SOURCE_ID)?.setData({
    type: "FeatureCollection",
    features: point
      ? [{ type: "Feature", geometry: { type: "Point", coordinates: [point.longitude, point.latitude] }, properties: {} }]
      : [],
  });
}
