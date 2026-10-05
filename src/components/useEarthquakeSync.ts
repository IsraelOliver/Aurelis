"use client";

import { useEffect, useRef, useState } from "react";
import type { EarthquakeFeed } from "@/types";
import { POLL_INTERVAL_MS } from "@/lib/source-health";

export interface EarthquakeSync {
  /** Latest valid snapshot; kept when a later attempt fails. */
  snapshot: EarthquakeFeed | null;
  attempted: boolean;
  lastAttemptFailed: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  /** Snapshot age when received (server clock), and client time of receipt. */
  ageAtReceiptMs?: number;
  receivedAtMs?: number;
}

/**
 * Polls the internal API (never USGS directly) in a controlled loop:
 * fetch → wait for it to finish → schedule the next one. At most one request
 * in flight and one timer. Cleanup aborts both, so StrictMode's
 * mount/unmount/mount leaves a single chain.
 */
export function useEarthquakeSync(
  onSnapshot: (feed: EarthquakeFeed) => void,
): EarthquakeSync {
  const [state, setState] = useState<EarthquakeSync>({
    snapshot: null,
    attempted: false,
    lastAttemptFailed: false,
  });
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failing = false;

    const run = async () => {
      controller = new AbortController();
      const lastAttemptAt = new Date().toISOString();
      try {
        const response = await fetch("/api/earthquakes", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const feed = (await response.json()) as EarthquakeFeed;
        if (stopped) return;

        const receivedAtMs = Date.now();
        // Age measured with the server's clock (Date header) to avoid client clock skew.
        const serverNow = Date.parse(response.headers.get("date") ?? "");
        const ageAtReceiptMs = Math.max(
          0,
          (Number.isFinite(serverNow) ? serverNow : receivedAtMs) -
            Date.parse(feed.metadata.ingestedAt),
        );

        failing = false;
        onSnapshotRef.current(feed);
        setState({
          snapshot: feed,
          attempted: true,
          lastAttemptFailed: false,
          lastAttemptAt,
          lastSuccessAt: new Date(receivedAtMs).toISOString(),
          ageAtReceiptMs,
          receivedAtMs,
        });
      } catch (error) {
        if (stopped) return;
        // Log once per failure streak, not every minute.
        if (!failing) console.warn("[AURELIS] Earthquake sync failed:", error);
        failing = true;
        // Keep the last snapshot: a failed refresh does not erase valid data.
        setState((prev) => ({
          ...prev,
          attempted: true,
          lastAttemptFailed: true,
          lastAttemptAt,
        }));
      }
      if (!stopped) timer = setTimeout(run, POLL_INTERVAL_MS);
    };

    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, []);

  return state;
}
