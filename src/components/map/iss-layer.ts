import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { ProjectionMode } from "@/lib/map-config";
import type { OrbitVertex } from "@/lib/iss-trail";
import { createIssOrbitTrailLayer, type IssOrbitTrailLayer } from "./iss-orbit-trail-layer";

/**
 * Map representation of the ISS: its own GeoJSON source, separate from the
 * earthquakes. One symbol layer draws the marker (outer ring + small solid
 * core) and its "ISS" label together, so on the globe both can be lifted to
 * the reported orbital altitude with `symbol-height-offset` (circle layers
 * cannot). The recent trail (received positions only, not an orbit) is shown
 * only while selected: on the flat map as a 2D line on the surface; on the
 * globe as a 3D line at orbital altitude ending at the marker
 * (iss-orbit-trail-layer.ts).
 */
export const ISS_SOURCE_ID = "aurelis-iss-source";
export const ISS_LAYER_ID = "aurelis-iss-layer";
export const ISS_TRAIL_SOURCE_ID = "aurelis-iss-trail-source";
export const ISS_TRAIL_LAYER_ID = "aurelis-iss-trail-layer";

/** Layers that respond to hover/click (the trail does not). */
export const ISS_INTERACTIVE_LAYERS = [ISS_LAYER_ID];

/** Fraction of the trail (oldest end) that fades from transparent to full opacity. */
const TRAIL_FADE = 0.35;

/** Per map: selection and projection decide which trail is drawn. */
type TrailState = { selected: boolean; projection: ProjectionMode; orbit: IssOrbitTrailLayer };
const trailState = new WeakMap<MapLibreMap, TrailState>();

function applyTrailVisibility(map: MapLibreMap): void {
  const state = trailState.get(map);
  if (!state) return;
  const flat = state.selected && state.projection === "mercator";
  map.setLayoutProperty(ISS_TRAIL_LAYER_ID, "visibility", flat ? "visible" : "none");
  if (!(state.selected && state.projection === "globe")) state.orbit.setStrips(null);
}

const ICON_NORMAL = "aurelis-iss-icon";
const ICON_SELECTED = "aurelis-iss-icon-selected";

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Ring + core marker (same proportions as the former circle layers), drawn at 2x. */
function markerImage(color: string): ImageData {
  const ratio = 2;
  const size = 26 * ratio;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;

  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25 * ratio;
  ctx.beginPath();
  ctx.arc(c, c, 11 * ratio, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = token("--aurelis-bg");
  ctx.beginPath();
  ctx.arc(c, c, 6 * ratio, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c, c, 4.5 * ratio, 0, Math.PI * 2);
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

export function addIssLayer(map: MapLibreMap): void {
  // Trail first, so it is drawn below the ISS marker.
  map.addSource(ISS_TRAIL_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: ISS_TRAIL_LAYER_ID,
    type: "line",
    source: ISS_TRAIL_SOURCE_ID,
    layout: {
      visibility: "none",
      // Butt caps: the trail is drawn as consecutive pieces, round caps would overlap at each joint.
      "line-cap": "butt",
    },
    paint: {
      "line-color": token("--aurelis-cyan"),
      // Oldest end fades out instead of ending abruptly.
      "line-opacity": ["interpolate", ["linear"], ["get", "progress"], 0, 0, TRAIL_FADE, 0.55],
      "line-width": 1.5,
    },
  });

  const orbit = createIssOrbitTrailLayer(token("--aurelis-cyan"));
  map.addLayer(orbit);
  trailState.set(map, { selected: false, projection: "globe", orbit });

  map.addImage(ICON_NORMAL, markerImage(token("--aurelis-cyan")), { pixelRatio: 2 });
  map.addImage(ICON_SELECTED, markerImage(token("--aurelis-gold")), { pixelRatio: 2 });

  map.addSource(ISS_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: ISS_LAYER_ID,
    type: "symbol",
    source: ISS_SOURCE_ID,
    layout: {
      "icon-image": ICON_NORMAL,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "text-field": "ISS",
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-letter-spacing": 0.2,
      "text-anchor": "left",
      "text-offset": [1.5, 0],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "symbol-height-offset": 0,
    },
    paint: {
      "text-color": token("--aurelis-cyan"),
      "text-halo-color": token("--aurelis-bg"),
      "text-halo-width": 1.5,
    },
  });
}

/**
 * Draws the ISS marker at its display position (smoothed, slightly delayed;
 * see lib/iss-interpolation.ts), or removes it when there is none. The
 * altitude (km, from the Observation) is converted to meters for display only.
 */
export function setIssMarker(
  map: MapLibreMap,
  entityId: string | null,
  position: { lon: number; lat: number; altitudeKm: number | null } | null,
): void {
  const data: FeatureCollection<Point, { entityId: string; altitudeMeters: number }> = {
    type: "FeatureCollection",
    features:
      entityId && position
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [position.lon, position.lat] },
              properties: { entityId, altitudeMeters: (position.altitudeKm ?? 0) * 1000 },
            },
          ]
        : [],
  };
  map.getSource<GeoJSONSource>(ISS_SOURCE_ID)?.setData(data);
}

/**
 * GLOBE: marker, label and trail at the reported orbital altitude (real
 * scale). FLAT: marker on the map and the 2D surface trail.
 */
export function setIssProjection(map: MapLibreMap, projection: ProjectionMode): void {
  map.setLayoutProperty(
    ISS_LAYER_ID,
    "symbol-height-offset",
    projection === "globe" ? ["get", "altitudeMeters"] : 0,
  );
  const state = trailState.get(map);
  if (state) state.projection = projection;
  applyTrailVisibility(map);
}

/**
 * Orbital trail geometry for the current frame (see orbitTrailStrips). Drawn
 * only while the ISS is selected and the projection is globe.
 */
export function setIssOrbitTrail(map: MapLibreMap, strips: OrbitVertex[][]): void {
  const state = trailState.get(map);
  if (state?.selected && state.projection === "globe") state.orbit.setStrips(strips);
}

/** True when the orbital trail is drawn (the animation loop only builds it then). */
export function isIssOrbitTrailActive(map: MapLibreMap): boolean {
  const state = trailState.get(map);
  return Boolean(state?.selected && state.projection === "globe");
}

/**
 * Updates the trail geometry (segments already split at gaps and the
 * antimeridian). Each piece between two consecutive vertices is its own
 * feature with its position along the trail (0 = oldest, 1 = newest), so the
 * oldest end can fade out (line opacity is data-driven per feature).
 */
export function setIssTrail(map: MapLibreMap, segments: [number, number][][]): void {
  const pieces = segments.flatMap((segment) =>
    segment.slice(1).map((end, i) => [segment[i], end] as [number, number][]),
  );
  map.getSource<GeoJSONSource>(ISS_TRAIL_SOURCE_ID)?.setData({
    type: "FeatureCollection",
    features: pieces.map((coordinates, i) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { progress: pieces.length > 1 ? i / (pieces.length - 1) : 1 },
    })),
  });
}

/** Gold marker and visible (cyan) trail when the ISS is selected; cyan marker, no trail otherwise. */
export function setIssSelected(map: MapLibreMap, selected: boolean): void {
  map.setLayoutProperty(ISS_LAYER_ID, "icon-image", selected ? ICON_SELECTED : ICON_NORMAL);
  map.setPaintProperty(ISS_LAYER_ID, "text-color", token(selected ? "--aurelis-gold" : "--aurelis-cyan"));
  const state = trailState.get(map);
  if (state) state.selected = selected;
  applyTrailVisibility(map);
}
