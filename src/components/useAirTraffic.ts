"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AirTrafficFeed } from "@/types";
import { AIR_POLL_MS } from "@/lib/sources/opensky/source";
import { isAirQuotaLow } from "@/lib/air-policy";

export type AirTrafficSync = {
  snapshot: AirTrafficFeed | null;
  /** Client clock when `snapshot` was received. */
  receivedAtMs: number | null;
  attempted: boolean;
  /** Last attempt since the last activation failed. */
  lastAttemptFailed: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  /** A refresh succeeded since AIR was last (re)activated. */
  refreshedSinceActivation: boolean;
  /** Remaining OpenSky credits cover ≤ AIR_QUOTA_RESERVE_REFRESHES refreshes: automatic refresh paused. */
  quotaLow: boolean;
  /** One explicit refresh (also when the quota is low). */
  refreshOnce: () => void;
};

/**
 * Global OpenSky snapshot, polled every AIR_POLL_MS ONLY while `active` (AIR
 * domain open and aircraft shown): leaving AIR or hiding the aircraft pauses
 * requests (quota), keeping the last snapshot. Re-activation shows that
 * snapshot at once and refreshes immediately. No automatic refresh while the
 * remaining credits are low.
 */
export function useAirTraffic(active: boolean, onSnapshot: (feed: AirTrafficFeed) => void): AirTrafficSync {
  const [state, setState] = useState<Omit<AirTrafficSync, "quotaLow" | "refreshOnce">>({
    snapshot: null,
    receivedAtMs: null,
    attempted: false,
    lastAttemptFailed: false,
    refreshedSinceActivation: false,
  });
  const onSnapshotRef = useRef(onSnapshot);
  const snapshotRef = useRef<AirTrafficFeed | null>(null);
  const busy = useRef(false);
  /** Restarts automatic polling (set while active), e.g. after a single refresh shows the quota recovered. */
  const resume = useRef<(() => void) | null>(null);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  // A new activation (adjusted during render, the React pattern for prop changes): the cached
  // snapshot is shown at once and its health waits for the refresh of this activation.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setState((prev) => ({ ...prev, lastAttemptFailed: false, refreshedSinceActivation: false }));
  }

  const fetchOnce = useCallback(async (signal?: AbortSignal) => {
    if (busy.current) return;
    busy.current = true;
    const lastAttemptAt = new Date().toISOString();
    try {
      const response = await fetch("/api/air/aircraft", { signal, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const feed = (await response.json()) as AirTrafficFeed;
      if (signal?.aborted) return;
      snapshotRef.current = feed;
      onSnapshotRef.current(feed);
      setState({
        snapshot: feed,
        receivedAtMs: Date.now(),
        attempted: true,
        lastAttemptFailed: false,
        lastAttemptAt,
        lastSuccessAt: new Date().toISOString(),
        refreshedSinceActivation: true,
      });
    } catch (error) {
      if (signal?.aborted) return;
      console.warn("[AURELIS] OpenSky sync failed:", error instanceof Error ? error.message : error);
      // The last snapshot stays; it becomes stale by the normal rules.
      setState((prev) => ({ ...prev, attempted: true, lastAttemptFailed: true, lastAttemptAt }));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let running = false;
    const loop = async () => {
      timer = undefined;
      running = true;
      if (!isAirQuotaLow(snapshotRef.current)) await fetchOnce(controller.signal);
      running = false;
      if (!stopped && !isAirQuotaLow(snapshotRef.current)) timer = setTimeout(loop, AIR_POLL_MS);
    };
    resume.current = () => {
      if (!stopped && !running && timer === undefined) timer = setTimeout(loop, AIR_POLL_MS);
    };
    loop();
    return () => {
      stopped = true;
      resume.current = null;
      clearTimeout(timer);
      controller.abort();
      busy.current = false;
    };
  }, [active, fetchOnce]);

  const refreshOnce = useCallback(() => {
    void fetchOnce().then(() => {
      if (!isAirQuotaLow(snapshotRef.current)) resume.current?.();
    });
  }, [fetchOnce]);

  return { ...state, quotaLow: isAirQuotaLow(state.snapshot), refreshOnce };
}
