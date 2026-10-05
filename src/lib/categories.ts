/**
 * Layer categories shown in the sidebar. Visual only: not wired to filters.
 */
export const CATEGORIES = [
  { id: "world", label: "WORLD" },
  { id: "cyber", label: "CYBER" },
  { id: "air", label: "AIR" },
  { id: "sea", label: "SEA" },
  { id: "space", label: "SPACE" },
  { id: "weather", label: "WEATHER" },
  { id: "disasters", label: "DISASTERS" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
