/**
 * Appearance (AURELIS 1.1): one theme per platform, chosen in Settings.
 *   desktop  `aurelis.theme`        ember (default) · atlas · basalt
 *   phone    `aurelis.mobileTheme`  ember (default) · atlas · basalt · azure
 * The two preferences are independent on purpose (future native apps).
 * The CSS reads a single pair of attributes on <html> —
 * `data-theme="<id>" data-tone="light|dark"` — filled from the preference of
 * the platform the viewport is on right now (PHONE_QUERY = the `phone`
 * Tailwind variant); the colors live in app/themes.css and only take effect
 * inside `.aurelis-shell` on desktop and phones. Tablets, the login screen,
 * the map and every data-layer color stay fixed. localStorage only; no
 * server state.
 */

export type ThemeId = "ember" | "atlas" | "basalt" | "azure";
export type Tone = "light" | "dark";
export type Platform = "desktop" | "mobile";

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tone: Tone;
  /** One line of concept, shown on the Settings card. */
  concept: string;
}

/** Desktop Settings › Themes, in display order (the identity first). */
export const THEMES: readonly ThemeInfo[] = [
  { id: "ember", name: "Ember", tone: "dark", concept: "Sunset signal · coral · indigo" },
  { id: "atlas", name: "Atlas", tone: "light", concept: "Contemporary cartography · paper · copper" },
  { id: "basalt", name: "Basalt", tone: "dark", concept: "Volcanic stone · bronze · oxidised metal" },
];

/** Phone Settings › Theme: the same three (shorter copy) plus Azure, phone only. */
export const MOBILE_THEMES: readonly ThemeInfo[] = [
  { id: "ember", name: "Ember", tone: "dark", concept: "Sunset signal · coral · indigo" },
  { id: "atlas", name: "Atlas", tone: "light", concept: "Cartography · paper · copper" },
  { id: "basalt", name: "Basalt", tone: "dark", concept: "Volcanic stone · bronze" },
  { id: "azure", name: "Azure", tone: "light", concept: "Clear sky · glass · cyan" },
];

export const DEFAULT_THEME: ThemeId = "ember";
export const STORAGE_KEYS: Record<Platform, string> = { desktop: "aurelis.theme", mobile: "aurelis.mobileTheme" };
/** Same media as the Tailwind `phone` variant (globals.css). */
export const PHONE_QUERY = "(width < 48rem), (width < 64rem) and (height < 30rem)";

const TONE: Record<ThemeId, Tone> = { ember: "dark", atlas: "light", basalt: "dark", azure: "light" };
const ALLOWED: Record<Platform, readonly ThemeId[]> = {
  desktop: THEMES.map((t) => t.id),
  mobile: MOBILE_THEMES.map((t) => t.id),
};

/** The stored theme of a platform; missing, invalid or unavailable storage → Ember. */
export function readTheme(platform: Platform): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEYS[platform]);
    return ALLOWED[platform].includes(v as ThemeId) ? (v as ThemeId) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(platform: Platform, id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEYS[platform], id);
  } catch {
    // Storage unavailable (private mode, quota): the choice lasts for this page only.
  }
}

export const currentPlatform = (): Platform => (window.matchMedia(PHONE_QUERY).matches ? "mobile" : "desktop");

/** Puts the theme of the platform the viewport is on onto <html>. */
export function applyTheme(): void {
  const id = readTheme(currentPlatform());
  const root = document.documentElement;
  root.dataset.theme = id;
  root.dataset.tone = TONE[id];
}

/**
 * Inline <head> script: sets the attributes before the first paint (no flash
 * of the wrong theme on either platform). Mirrors readTheme + applyTheme;
 * dependency-free because it runs before any bundle.
 */
export const THEME_SCRIPT = `(function(){var T=${JSON.stringify(TONE)},A=${JSON.stringify(ALLOWED)},K=${JSON.stringify(STORAGE_KEYS)},p="desktop",id="${DEFAULT_THEME}";try{if(matchMedia("${PHONE_QUERY}").matches)p="mobile"}catch(e){}try{var v=localStorage.getItem(K[p]);if(A[p].indexOf(v)>=0)id=v}catch(e){}var d=document.documentElement;d.dataset.theme=id;d.dataset.tone=T[id]})()`;
