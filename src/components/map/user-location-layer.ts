import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

/**
 * The user's own position (phone "locate" control): a dot with a soft halo
 * and the reported accuracy as a translucent circle. Not an Entity, not a
 * dataset, not clickable; drawn above every data layer. The color is its own
 * map token (--aurelis-you), distinct from every data layer and fixed across
 * themes like all map colors. The position never leaves the browser.
 */
export const USER_LOCATION_SOURCE_ID = "aurelis-user-location-source";
const ACCURACY_FILL_ID = "aurelis-user-location-accuracy";
const ACCURACY_LINE_ID = "aurelis-user-location-accuracy-line";
const HALO_ID = "aurelis-user-location-halo";
const DOT_ID = "aurelis-user-location-dot";

export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Radius of 68% confidence, in metres (Geolocation API `accuracy`). */
  accuracyM: number;
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A geodesic-enough circle (64 vertices) of `radiusM` metres around a point. */
function circle(lon: number, lat: number, radiusM: number): [number, number][] {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

export function addUserLocationLayer(map: MapLibreMap): void {
  const you = token("--aurelis-you");
  map.addSource(USER_LOCATION_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: ACCURACY_FILL_ID,
    type: "fill",
    source: USER_LOCATION_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": you, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: ACCURACY_LINE_ID,
    type: "line",
    source: USER_LOCATION_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": you, "line-opacity": 0.45, "line-width": 1 },
  });
  map.addLayer({
    id: HALO_ID,
    type: "circle",
    source: USER_LOCATION_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 16, "circle-color": you, "circle-opacity": 0.25, "circle-blur": 0.35 },
  });
  map.addLayer({
    id: DOT_ID,
    type: "circle",
    source: USER_LOCATION_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 7,
      "circle-color": you,
      "circle-stroke-color": token("--aurelis-text"),
      "circle-stroke-width": 2.5,
    },
  });
}

/** Draws the position (dot + accuracy), or nothing (null). */
export function setUserLocation(map: MapLibreMap, location: UserLocation | null): void {
  map.getSource<GeoJSONSource>(USER_LOCATION_SOURCE_ID)?.setData({
    type: "FeatureCollection",
    features: location
      ? [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [circle(location.longitude, location.latitude, location.accuracyM)],
            },
            properties: {},
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [location.longitude, location.latitude] },
            properties: {},
          },
        ]
      : [],
  });
}
