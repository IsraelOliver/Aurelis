"use client";

import { useSyncExternalStore } from "react";

/**
 * Where the selected Weather point is on screen (viewport pixels), published
 * by WorldMap whenever the camera moves and read by the phone Weather popover.
 * A tiny store outside React state on purpose: the map moves every frame
 * while panning, and only the popover needs to follow — not the workspace.
 * `visible` is false when the point is off screen or behind the globe.
 */
export type PointAnchor = { x: number; y: number; visible: boolean } | null;

let current: PointAnchor = null;
const listeners = new Set<() => void>();

export function publishWeatherAnchor(next: PointAnchor): void {
  const same =
    current === next ||
    (current && next && current.x === next.x && current.y === next.y && current.visible === next.visible);
  if (same) return;
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWeatherAnchor(): PointAnchor {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
