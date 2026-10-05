import type { Map as MapLibreMap } from "maplibre-gl";
import type { BasemapMode } from "@/lib/map-config";
import type { EsriImagerySource } from "@/lib/esri-imagery";

/**
 * Basemap switching inside the single AURELIS style (no setStyle, no second map).
 * SATELLITE = Esri World Imagery raster at the bottom + AURELIS reference
 * overlays (borders and place labels) restyled for photos. DARK = original
 * AURELIS style, restored exactly. AURELIS data layers ("aurelis-*") are never touched.
 */
export const IMAGERY_SOURCE_ID = "aurelis-basemap-imagery-source";
export const IMAGERY_LAYER_ID = "aurelis-basemap-imagery-layer";

/** Basemap layers kept over the imagery; every other basemap layer is hidden. */
const OVERLAY_IN_SATELLITE = /^(boundary_|place_)/;

/** Paint property names as typed by MapLibre. */
type PaintProp = Parameters<MapLibreMap["setPaintProperty"]>[1];
type PaintValue = Parameters<MapLibreMap["setPaintProperty"]>[2];

type Saved = {
  visibility: Map<string, "visible" | "none">;
  paint: { layer: string; prop: PaintProp; value: PaintValue }[];
};
const saved = new WeakMap<MapLibreMap, Saved>();

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const basemapLayers = (map: MapLibreMap) =>
  map.getStyle().layers.filter((l) => !l.id.startsWith("aurelis-"));

/** Adds the imagery source/layer once, below every other layer except the background. */
export function addImageryLayer(map: MapLibreMap, imagery: EsriImagerySource): void {
  if (map.getSource(IMAGERY_SOURCE_ID)) return;
  map.addSource(IMAGERY_SOURCE_ID, {
    type: "raster",
    tiles: imagery.tiles,
    tileSize: imagery.tileSize,
    ...(imagery.maxzoom !== undefined ? { maxzoom: imagery.maxzoom } : {}),
    attribution: imagery.attribution,
  });
  const beforeId = map.getStyle().layers.find((l) => l.type !== "background")?.id;
  map.addLayer(
    { id: IMAGERY_LAYER_ID, type: "raster", source: IMAGERY_SOURCE_ID, layout: { visibility: "none" } },
    beforeId,
  );
}

/** Paint overrides for the overlays kept over imagery (readable on ocean, forest, desert, snow). */
function satellitePaint(layerId: string): [PaintProp, PaintValue][] {
  if (layerId.startsWith("place_")) {
    return [
      ["text-color", token("--aurelis-text")],
      ["text-halo-color", token("--aurelis-bg")],
      ["text-halo-width", 1.4],
      ["text-halo-blur", 0.5],
    ];
  }
  if (layerId === "boundary_state") return [["line-color", token("--aurelis-text-subtle")]];
  if (layerId.startsWith("boundary_")) return [["line-color", token("--aurelis-text-muted")]];
  return [];
}

export function applyBasemapMode(map: MapLibreMap, mode: BasemapMode): void {
  const satellite = mode === "satellite" && Boolean(map.getLayer(IMAGERY_LAYER_ID));
  const layers = basemapLayers(map).filter((l) => l.id !== IMAGERY_LAYER_ID);

  let original = saved.get(map);
  if (!original) {
    original = { visibility: new Map(), paint: [] };
    for (const l of layers) {
      original.visibility.set(l.id, map.getLayoutProperty(l.id, "visibility") === "none" ? "none" : "visible");
      for (const [prop] of satellitePaint(l.id)) {
        original.paint.push({ layer: l.id, prop, value: map.getPaintProperty(l.id, prop) as PaintValue });
      }
    }
    saved.set(map, original);
  }

  for (const l of layers) {
    const visibility = satellite
      ? OVERLAY_IN_SATELLITE.test(l.id)
        ? original.visibility.get(l.id) ?? "visible"
        : "none"
      : original.visibility.get(l.id) ?? "visible";
    map.setLayoutProperty(l.id, "visibility", visibility);
  }

  if (satellite) {
    for (const l of layers) {
      for (const [prop, value] of satellitePaint(l.id)) map.setPaintProperty(l.id, prop, value);
    }
  } else {
    for (const { layer, prop, value } of original.paint) map.setPaintProperty(layer, prop, value);
  }

  // Hidden layer → MapLibre stops requesting imagery tiles (no quota use in DARK).
  if (map.getLayer(IMAGERY_LAYER_ID)) {
    map.setLayoutProperty(IMAGERY_LAYER_ID, "visibility", satellite ? "visible" : "none");
  }
}
