"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  PHONE_QUERY,
  STORAGE_KEYS,
  applyTheme,
  currentPlatform,
  readTheme,
  writeTheme,
  type Platform,
  type ThemeId,
} from "@/lib/appearance";

/*
 * One small store per platform over localStorage. The server snapshot is the
 * default (the Settings UIs only render after interaction).
 */
const snapshots: Record<Platform, ThemeId | null> = { desktop: null, mobile: null };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function refresh() {
  snapshots.desktop = readTheme("desktop");
  snapshots.mobile = readTheme("mobile");
  for (const l of listeners) l();
}

/** The theme of one platform and a setter that persists it and applies it live (when on that platform). */
export function useTheme(platform: Platform = "desktop") {
  const theme = useSyncExternalStore(
    subscribe,
    () => (snapshots[platform] ??= readTheme(platform)),
    () => DEFAULT_THEME,
  );
  const setTheme = useCallback(
    (id: ThemeId) => {
      writeTheme(platform, id);
      snapshots[platform] = id;
      applyTheme();
      for (const l of listeners) l();
    },
    [platform],
  );
  return { theme, setTheme };
}

/**
 * Mounted once by the workspace: the viewport crossing between phone and
 * desktop/tablet switches to that platform's theme; a change made in another
 * tab is picked up.
 */
export function useThemeSync() {
  useEffect(() => {
    const phone = window.matchMedia(PHONE_QUERY);
    const onPlatform = () => applyTheme();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEYS.desktop && e.key !== STORAGE_KEYS.mobile) return;
      refresh();
      applyTheme();
    };
    // The head script already applied it; this re-asserts after hydration (no-op when consistent).
    if (document.documentElement.dataset.theme !== readTheme(currentPlatform())) applyTheme();
    phone.addEventListener("change", onPlatform);
    window.addEventListener("storage", onStorage);
    return () => {
      phone.removeEventListener("change", onPlatform);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
