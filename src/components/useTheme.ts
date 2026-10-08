"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_THEME, STORAGE_KEY, applyTheme, readTheme, writeTheme, type ThemeId } from "@/lib/appearance";

/*
 * One small store over localStorage. The server snapshot is the default (the
 * Settings window only renders after interaction).
 */
let snapshot: ThemeId | null = null;
const listeners = new Set<() => void>();

const getSnapshot = (): ThemeId => (snapshot ??= readTheme());
const getServerSnapshot = (): ThemeId => DEFAULT_THEME;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(id: ThemeId) {
  snapshot = id;
  for (const l of listeners) l();
}

/** The current theme and a setter that applies it live and persists it. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((id: ThemeId) => {
    writeTheme(id);
    applyTheme(id);
    set(id);
  }, []);
  return { theme, setTheme };
}

/** Mounted once by the workspace: picks up a theme changed in another tab. */
export function useThemeSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const id = readTheme();
      applyTheme(id);
      set(id);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
