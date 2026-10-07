"use client";

import { useEffect, useRef, useState } from "react";
import type { CloudCoverFeed, CloudCoverGridInfo } from "@/types";

/** One GFS field as shown: metadata and its grid, always replaced together. */
export type CloudSnapshot = { feed: CloudCoverFeed; values: Uint16Array };

export type CloudCoverSync = {
  snapshot: CloudSnapshot | null;
  attempted: boolean;
  lastAttemptFailed: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
};

/** Reads and checks the binary grid (size, encoding, every value 0–1000 or no data). */
async function fetchGrid(info: CloudCoverGridInfo, signal: AbortSignal): Promise<Uint16Array> {
  if (info.encoding !== "uint16le-tenths-percent" || info.byteLength !== info.width * info.height * 2) {
    throw new Error("unexpected cloud grid description");
  }
  const response = await fetch(info.url, { signal });
  if (!response.ok) throw new Error(`grid HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== info.byteLength) throw new Error(`grid ${buffer.byteLength} bytes, expected ${info.byteLength}`);
  const view = new DataView(buffer);
  const values = new Uint16Array(info.width * info.height);
  for (let i = 0; i < values.length; i++) {
    const v = view.getUint16(i * 2, true);
    if (v > 1000 && v !== info.noDataValue) throw new Error(`grid value ${v} out of range`);
    values[i] = v;
  }
  return values;
}

/**
 * GFS cloud cover, only while `active` (layer shown): nothing is requested
 * before the first SHOW. Polls /api/weather/clouds (metadata, ~1 kB); the grid
 * is downloaded only when the field id changes. The new field replaces the
 * shown one atomically after full validation; a failure keeps the previous
 * snapshot. Hiding stops polling but keeps the snapshot for the session, and
 * showing again within the poll interval makes no request at all.
 */
export function useCloudCover(active: boolean, pollIntervalMs: number): CloudCoverSync {
  const [state, setState] = useState<CloudCoverSync>({ snapshot: null, attempted: false, lastAttemptFailed: false });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failing = false;

    const run = async () => {
      controller = new AbortController();
      const lastAttemptAt = new Date().toISOString();
      try {
        const response = await fetch("/api/weather/clouds", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const feed = (await response.json()) as CloudCoverFeed;
        const shown = stateRef.current.snapshot;
        const values =
          shown && shown.feed.grid.id === feed.grid.id ? shown.values : await fetchGrid(feed.grid, controller.signal);
        if (stopped) return;
        failing = false;
        setState({
          snapshot: { feed, values },
          attempted: true,
          lastAttemptFailed: false,
          lastAttemptAt,
          lastSuccessAt: new Date().toISOString(),
        });
      } catch (error) {
        if (stopped) return;
        if (!failing) console.warn("[AURELIS] NOAA GFS clouds sync failed:", error);
        failing = true;
        // The field on the map stays until a new one is fully valid.
        setState((prev) => ({ ...prev, attempted: true, lastAttemptFailed: true, lastAttemptAt }));
      }
      if (!stopped) timer = setTimeout(run, pollIntervalMs);
    };

    const lastSuccess = Date.parse(stateRef.current.lastSuccessAt ?? "");
    const wait = Number.isFinite(lastSuccess) ? Math.max(0, lastSuccess + pollIntervalMs - Date.now()) : 0;
    timer = setTimeout(run, wait);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [active, pollIntervalMs]);

  return state;
}
