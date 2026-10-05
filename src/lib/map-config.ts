/**
 * Basemap style owned by AURELIS (versioned in public/map-styles/).
 * Cartography comes from OpenFreeMap vector tiles (OpenMapTiles schema,
 * OpenStreetMap data); the required attribution is read from the tile
 * source and rendered by MapLibre's attribution control.
 * See docs/MAP_ARCHITECTURE.md.
 */
export const BASEMAP_STYLE_URL = "/map-styles/aurelis-dark.json";

/**
 * How the Earth is projected. Independent of the basemap (today: OpenFreeMap +
 * AURELIS style); a future basemapMode (e.g. satellite) will combine with it.
 */
export type ProjectionMode = "globe" | "mercator";
export const DEFAULT_PROJECTION: ProjectionMode = "globe";

/**
 * Which basemap is drawn under the AURELIS layers. Independent of the projection.
 * - "dark": OpenFreeMap tiles + AURELIS style (default).
 * - "satellite": Esri World Imagery + AURELIS reference overlays (borders, labels).
 */
export type BasemapMode = "dark" | "satellite";
export const DEFAULT_BASEMAP: BasemapMode = "dark";

export const INITIAL_VIEW = {
  center: [12, 22] as [number, number],
  zoom: 1.6,
  minZoom: 1,
  maxZoom: 18,
  // Mercator: one world only, entities never duplicated across copies (no effect on the globe).
  renderWorldCopies: false,
};

/** Served from public/, copied there by scripts/copy-maplibre-worker.mjs. */
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";
