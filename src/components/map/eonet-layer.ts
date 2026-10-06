import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { EonetEventObservation } from "@/types";
import { eonetMapFeatures } from "@/lib/eonet-map";
import { EARTHQUAKES_LAYER_ID } from "./earthquake-layer";

/**
 * NASA EONET natural events (latest geometry of each open event), on the
 * surface: one GeoJSON source; polygon fill below borders/labels, polygon
 * outline and point rings above them but below earthquakes and the ISS.
 * Points are hollow rings (unlike the filled earthquake circles); one color
 * for all categories; gold when selected. No tracks, no clustering.
 * Optional and hidden by default: hidden layers are not drawn and not
 * clickable; the data stays loaded.
 */
export const EONET_SOURCE_ID = "aurelis-eonet-source";
export const EONET_FILL_LAYER_ID = "aurelis-eonet-fill-layer";
export const EONET_OUTLINE_LAYER_ID = "aurelis-eonet-outline-layer";
export const EONET_POINT_LAYER_ID = "aurelis-eonet-point-layer";

/** Clickable EONET layers, top-most first. */
export const EONET_INTERACTIVE_LAYERS = [EONET_POINT_LAYER_ID, EONET_OUTLINE_LAYER_ID, EONET_FILL_LAYER_ID];

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const isSelected = (id: string | null): ExpressionSpecification => ["==", ["get", "entityId"], id ?? ""];

export function addEonetLayer(map: MapLibreMap): void {
  map.addSource(EONET_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  const borders = map.getStyle().layers.find((l) => l.id.startsWith("boundary_"))?.id;
  map.addLayer(
    {
      id: EONET_FILL_LAYER_ID,
      type: "fill",
      source: EONET_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      layout: { visibility: "none" },
      paint: { "fill-color": token("--aurelis-cyan"), "fill-opacity": 0.06 },
    },
    borders,
  );
  map.addLayer(
    {
      id: EONET_OUTLINE_LAYER_ID,
      type: "line",
      source: EONET_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      layout: { visibility: "none" },
      paint: { "line-color": token("--aurelis-cyan"), "line-opacity": 0.55, "line-width": 1 },
    },
    EARTHQUAKES_LAYER_ID,
  );
  map.addLayer(
    {
      id: EONET_POINT_LAYER_ID,
      type: "circle",
      source: EONET_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 3.5,
        "circle-color": token("--aurelis-bg"),
        "circle-opacity": 0.5,
        "circle-stroke-color": token("--aurelis-cyan"),
        "circle-stroke-width": 1.25,
        "circle-stroke-opacity": 0.85,
      },
    },
    EARTHQUAKES_LAYER_ID,
  );
}

/** Shows or hides all EONET layers (visibility only; source data is kept). */
export function setEonetVisible(map: MapLibreMap, visible: boolean): void {
  for (const id of EONET_INTERACTIVE_LAYERS) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

/** Replaces the features (latest geometry per event). */
export function setEonetData(map: MapLibreMap, observations: EonetEventObservation[]): void {
  map.getSource<GeoJSONSource>(EONET_SOURCE_ID)?.setData(eonetMapFeatures(observations));
}

/** Gold outline/ring (and a slightly stronger fill) for the selected event. */
export function setSelectedEonet(map: MapLibreMap, entityId: string | null): void {
  const cyan = token("--aurelis-cyan");
  const gold = token("--aurelis-gold");
  const sel = isSelected(entityId);
  map.setPaintProperty(EONET_POINT_LAYER_ID, "circle-stroke-color", ["case", sel, gold, cyan]);
  map.setPaintProperty(EONET_POINT_LAYER_ID, "circle-radius", ["case", sel, 5, 3.5]);
  map.setPaintProperty(EONET_OUTLINE_LAYER_ID, "line-color", ["case", sel, gold, cyan]);
  map.setPaintProperty(EONET_OUTLINE_LAYER_ID, "line-width", ["case", sel, 1.75, 1]);
  map.setPaintProperty(EONET_FILL_LAYER_ID, "fill-opacity", ["case", sel, 0.14, 0.06]);
  // Selected point drawn above the others.
  map.setLayoutProperty(EONET_POINT_LAYER_ID, "circle-sort-key", ["case", sel, 1, 0]);
}
