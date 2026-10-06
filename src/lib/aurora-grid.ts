import type { AuroraGridCell } from "@/types";

/**
 * Rendering input for the OVATION aurora layer: the published 1° grid packed
 * into a 360 × 181 value array (one texel per grid point). This is a copy of
 * the source values for the GPU, not new data: no value is changed, added or
 * smoothed here. Smoothing happens only at draw time (texture filtering).
 */

/** Grid of the product (verified on the live file: 360 longitudes × 181 latitudes, 1° apart). */
export const AURORA_GRID_WIDTH = 360;
export const AURORA_GRID_HEIGHT = 181;

/**
 * Row-major values, row = latitude + 90 (−90 → 0 … 90 → 180), column =
 * source longitude 0..359 (normalized −180..180 is wrapped back: −1 → 359).
 * Cells not listed (the source's zeros) stay 0. Points off the 1° grid are
 * ignored (none exist in the verified product).
 */
export function auroraValueGrid(cells: AuroraGridCell[]): Float32Array {
  const grid = new Float32Array(AURORA_GRID_WIDTH * AURORA_GRID_HEIGHT);
  for (const [lon, lat, value] of cells) {
    if (!Number.isInteger(lon) || !Number.isInteger(lat)) continue;
    const column = ((lon % 360) + 360) % 360;
    const row = lat + 90;
    if (row < 0 || row >= AURORA_GRID_HEIGHT) continue;
    grid[row * AURORA_GRID_WIDTH + column] = value;
  }
  return grid;
}
