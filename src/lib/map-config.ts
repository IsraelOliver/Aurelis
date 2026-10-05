/**
 * Basemap style owned by AURELIS (versioned in public/map-styles/).
 * Cartography comes from OpenFreeMap vector tiles (OpenMapTiles schema,
 * OpenStreetMap data); the required attribution is read from the tile
 * source and rendered by MapLibre's attribution control.
 * See docs/MAP_ARCHITECTURE.md.
 */
export const BASEMAP_STYLE_URL = "/map-styles/aurelis-dark.json";

export const INITIAL_VIEW = {
  center: [12, 22] as [number, number],
  zoom: 1.6,
  minZoom: 1,
  maxZoom: 18,
  // One world only: entities must never appear duplicated across copies.
  renderWorldCopies: false,
};

/** Served from public/, copied there by scripts/copy-maplibre-worker.mjs. */
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";
