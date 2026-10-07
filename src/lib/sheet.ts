/**
 * Compact layout (below Tailwind `lg`, 1024 px): data panels (SPACE, WEATHER,
 * DISASTERS, AIR, ISS, earthquake, EONET, aircraft) become a bottom sheet
 * over the map, so the geographic context stays visible. One source for its
 * heights, used both by the sheet and by the map controls that must stay above
 * it (`--sheet-offset`). `dvh` follows the mobile browser bars; the collapsed
 * height keeps the handle and the panel header visible.
 * SMILEY is the intentional exception: full screen below `lg` (SmileyDock).
 * At `lg` and above none of this applies (the desktop side panel is unchanged).
 */
export type SheetSize = "collapsed" | "medium" | "expanded";

export const SHEET_HEIGHT: Record<SheetSize, string> = {
  collapsed: "calc(6.5rem + env(safe-area-inset-bottom))",
  medium: "48dvh",
  expanded: "82dvh",
};

/** A newly opened data panel starts half-way: data and map both visible. */
export const DEFAULT_SHEET_SIZE: SheetSize = "medium";
