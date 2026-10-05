/**
 * Layer categories shown in the sidebar.
 * Placeholder: no data source is connected to any of them yet.
 */
export const CATEGORIES = [
  { id: "world", label: "WORLD" },
  { id: "cyber", label: "CYBER" },
  { id: "air", label: "AIR" },
  { id: "sea", label: "SEA" },
  { id: "weather", label: "WEATHER" },
  { id: "disasters", label: "DISASTERS" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
