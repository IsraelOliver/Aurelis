import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { IssFeed } from "@/types";

/**
 * Map representation of the ISS: its own GeoJSON source, separate from the
 * earthquakes. Distinguished from an earthquake by an outer ring (halo), a
 * small solid core and an "ISS" label. Only the latest position (no track).
 */
export const ISS_SOURCE_ID = "aurelis-iss-source";
export const ISS_HALO_LAYER_ID = "aurelis-iss-halo-layer";
export const ISS_LAYER_ID = "aurelis-iss-layer";
export const ISS_LABEL_LAYER_ID = "aurelis-iss-label-layer";

/** Layers that respond to hover/click. */
export const ISS_INTERACTIVE_LAYERS = [ISS_LAYER_ID, ISS_HALO_LAYER_ID];

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function addIssLayer(map: MapLibreMap): void {
  map.addSource(ISS_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: ISS_HALO_LAYER_ID,
    type: "circle",
    source: ISS_SOURCE_ID,
    paint: {
      "circle-radius": 11,
      "circle-opacity": 0,
      "circle-stroke-width": 1.25,
      "circle-stroke-color": token("--aurelis-cyan"),
      "circle-stroke-opacity": 0.75,
    },
  });

  map.addLayer({
    id: ISS_LAYER_ID,
    type: "circle",
    source: ISS_SOURCE_ID,
    paint: {
      "circle-radius": 4.5,
      "circle-color": token("--aurelis-cyan"),
      "circle-stroke-color": token("--aurelis-bg"),
      "circle-stroke-width": 1.5,
    },
  });

  map.addLayer({
    id: ISS_LABEL_LAYER_ID,
    type: "symbol",
    source: ISS_SOURCE_ID,
    layout: {
      "text-field": "ISS",
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-letter-spacing": 0.2,
      "text-anchor": "left",
      "text-offset": [1.5, 0],
    },
    paint: {
      "text-color": token("--aurelis-cyan"),
      "text-halo-color": token("--aurelis-bg"),
      "text-halo-width": 1.5,
    },
  });
}

export function setIssData(map: MapLibreMap, feed: IssFeed | null): void {
  const data: FeatureCollection<Point, { entityId: string }> = {
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
              properties: { entityId: entity.id },
            },
          ]
        : [],
    ),
  };
  map.getSource<GeoJSONSource>(ISS_SOURCE_ID)?.setData(data);
}

/** Gold when the ISS is the selected entity, cyan otherwise. */
export function setIssSelected(map: MapLibreMap, selected: boolean): void {
  const color = token(selected ? "--aurelis-gold" : "--aurelis-cyan");
  map.setPaintProperty(ISS_HALO_LAYER_ID, "circle-stroke-color", color);
  map.setPaintProperty(ISS_LAYER_ID, "circle-color", color);
  map.setPaintProperty(ISS_LABEL_LAYER_ID, "text-color", color);
}
