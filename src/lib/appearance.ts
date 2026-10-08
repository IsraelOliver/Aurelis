/**
 * Desktop appearance (AURELIS 1.1): one theme, chosen in Settings › Themes.
 *   ember  — the AURELIS identity (default)
 *   atlas  — light alternative
 *   basalt — dark alternative
 * Applied as `<html data-theme="<id>" data-tone="light|dark">`; the colors
 * live in app/themes.css and only take effect at `lg`+ inside
 * `.aurelis-shell` — compact layouts, the login screen, the map and every
 * data-layer color stay fixed. Persisted per browser in localStorage (one
 * key); no server state.
 */

export type ThemeId = "ember" | "atlas" | "basalt";
export type Tone = "light" | "dark";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tone: Tone;
  /** One line of concept, shown on the Settings card. */
  concept: string;
}

/** Display order: the identity first. */
export const THEMES: readonly ThemeInfo[] = [
  { id: "ember", name: "Ember", tone: "dark", concept: "Sunset signal · coral · indigo" },
  { id: "atlas", name: "Atlas", tone: "light", concept: "Contemporary cartography · paper · copper" },
  { id: "basalt", name: "Basalt", tone: "dark", concept: "Volcanic stone · bronze · oxidised metal" },
];

export const DEFAULT_THEME: ThemeId = "ember";
export const STORAGE_KEY = "aurelis.theme";

const TONE = Object.fromEntries(THEMES.map((t) => [t.id, t.tone])) as Record<ThemeId, Tone>;
const isTheme = (v: unknown): v is ThemeId => typeof v === "string" && v in TONE;

/** The stored theme; invalid values or unavailable storage fall back to Ember. */
export function readTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable (private mode, quota): the choice lasts for this page only.
  }
}

export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  root.dataset.theme = id;
  root.dataset.tone = TONE[id];
}

/**
 * Inline <head> script: sets the attributes before the first paint (no flash
 * of the wrong theme). Mirrors readTheme + applyTheme; dependency-free
 * because it runs before any bundle.
 */
export const THEME_SCRIPT = `(function(){var T=${JSON.stringify(TONE)},id="${DEFAULT_THEME}";try{var v=localStorage.getItem("${STORAGE_KEY}");if(v&&T.hasOwnProperty(v))id=v}catch(e){}var d=document.documentElement;d.dataset.theme=id;d.dataset.tone=T[id]})()`;
