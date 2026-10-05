"use client";

import { useEffect, useRef, useState } from "react";

/** Any normalized snapshot served by an internal source route. */
interface Snapshot {
  metadata: { ingestedAt: string };
}

export interface SourceSync<T extends Snapshot> {
  /** Latest valid snapshot; kept when a later attempt fails. */
  snapshot: T | null;
  attempted: boolean;
  lastAttemptFailed: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  /** Snapshot age when received (server clock), and client time of receipt. */
  ageAtReceiptMs?: number;
  receivedAtMs?: number;
}

/**
 * Polls one internal API route (never the external source) in a controlled
 * loop: fetch → wait for it to finish → schedule the next one. At most one
 * request in flight and one timer per source. Cleanup aborts both, so
 * StrictMode's mount/unmount/mount leaves a single chain.
 */
export function useSourceSync<T extends Snapshot>(
  url: string,
  pollIntervalMs: number,
  label: string,
  onSnapshot: (snapshot: T) => void,
): SourceSync<T> {
  const [state, setState] = useState<SourceSync<T>>({
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
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const snapshot = (await response.json()) as T;
        if (stopped) return;

        const receivedAtMs = Date.now();
        // Age measured with the server's clock (Date header) to avoid client clock skew.
        const serverNow = Date.parse(response.headers.get("date") ?? "");
        const ageAtReceiptMs = Math.max(
          0,
          (Number.isFinite(serverNow) ? serverNow : receivedAtMs) -
            Date.parse(snapshot.metadata.ingestedAt),
        );

        failing = false;
        onSnapshotRef.current(snapshot);
        setState({
          snapshot,
          attempted: true,
          lastAttemptFailed: false,
          lastAttemptAt,
          lastSuccessAt: new Date(receivedAtMs).toISOString(),
          ageAtReceiptMs,
          receivedAtMs,
        });
      } catch (error) {
        if (stopped) return;
        // Log once per failure streak, not on every poll.
        if (!failing) console.warn(`[AURELIS] ${label} sync failed:`, error);
        failing = true;
        // Keep the last snapshot: a failed refresh does not erase valid data.
        setState((prev) => ({
          ...prev,
          attempted: true,
          lastAttemptFailed: true,
          lastAttemptAt,
        }));
      }
      if (!stopped) timer = setTimeout(run, pollIntervalMs);
    };

    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [url, pollIntervalMs, label]);

  return state;
}
