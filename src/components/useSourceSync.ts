"use client";

import { useEffect, useRef, useState } from "react";
import {
  emptySyncState,
  syncFailed,
  syncStateFor,
  syncSucceeded,
  type SyncState,
} from "@/lib/sync-state";

/** Any normalized snapshot served by an internal source route. */
interface Snapshot {
  metadata: { ingestedAt: string };
}

export type SourceSync<T extends Snapshot> = Omit<SyncState<T>, "url"> & {
  /** Fetch the same URL again now (e.g. a Retry after a failure); the loop continues from there. */
  retry: () => void;
};

/**
 * Polls one internal API route (never the external source) in a controlled
 * loop: fetch → wait for it to finish → schedule the next one. At most one
 * request in flight and one timer per source. Cleanup aborts both, so
 * StrictMode's mount/unmount/mount leaves a single chain.
 *
 * `url` may change (query-scoped sources, e.g. a weather point) or be null
 * (no query: nothing is fetched). State is scoped to the URL: a snapshot is
 * kept on failure only for refreshes of the same URL, never shown for another.
 */
export function useSourceSync<T extends Snapshot>(
  url: string | null,
  pollIntervalMs: number,
  label: string,
  onSnapshot: (snapshot: T) => void,
): SourceSync<T> {
  const [state, setState] = useState<SyncState<T>>(() => emptySyncState<T>(url));
  // Bumped by retry(): restarts the loop for the same URL (one request in flight still).
  const [attempt, setAttempt] = useState(0);
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    if (url === null) return;
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
        setState(syncSucceeded(url, snapshot, { lastAttemptAt, receivedAtMs, ageAtReceiptMs }));
      } catch (error) {
        if (stopped) return;
        // Log once per failure streak, not on every poll.
        if (!failing) console.warn(`[AURELIS] ${label} sync failed:`, error);
        failing = true;
        // Keep the last snapshot of THIS url: a failed refresh does not erase valid data.
        setState((prev) => syncFailed(prev, url, lastAttemptAt));
      }
      if (!stopped) timer = setTimeout(run, pollIntervalMs);
    };

    run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [url, pollIntervalMs, label, attempt]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url: _ignored, ...visible } = syncStateFor(state, url);
  return { ...visible, retry: () => setAttempt((a) => a + 1) };
}
