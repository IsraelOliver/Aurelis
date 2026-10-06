/**
 * Map layer VISIBILITY (rendering and interaction only). DATA AVAILABILITY ≠
 * MAP VISIBILITY: hiding a layer never stops fetching/polling and never
 * changes SourceHealth, snapshots, Entities, Observations, SOURCES or ENTITIES.
 * Only layers that exist are listed. Session state, not persisted.
 */
export type MapLayerId = "earthquakes" | "eonet" | "aurora";

export type MapLayerVisibility = Record<MapLayerId, boolean>;

export const DEFAULT_LAYER_VISIBILITY: MapLayerVisibility = {
  // USGS earthquakes: visible.
  earthquakes: true,
  // NASA EONET: hidden (thousands of open events, mostly wildfires).
  eonet: false,
  // OVATION aurora: off until SHOW ON MAP (unchanged since 6B).
  aurora: false,
};
