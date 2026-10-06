/**
 * Pure state transitions of a source sync, scoped to the URL (query) they
 * belong to. For fixed-URL sources this changes nothing; for query-scoped
 * sources (e.g. a weather point) it guarantees that a snapshot of query A is
 * never shown for query B: retention of a snapshot on failure only applies to
 * refreshes of the SAME query.
 */
export interface SyncState<T> {
  /** Query the state belongs to (null: no query). */
  url: string | null;
  snapshot: T | null;
  attempted: boolean;
  lastAttemptFailed: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  ageAtReceiptMs?: number;
  receivedAtMs?: number;
}

export const emptySyncState = <T>(url: string | null): SyncState<T> => ({
  url,
  snapshot: null,
  attempted: false,
  lastAttemptFailed: false,
});

/** State as seen for `url`: another query's state is never reused. */
export function syncStateFor<T>(state: SyncState<T>, url: string | null): SyncState<T> {
  return state.url === url ? state : emptySyncState<T>(url);
}

export function syncSucceeded<T>(
  url: string,
  snapshot: T,
  info: { lastAttemptAt: string; receivedAtMs: number; ageAtReceiptMs: number },
): SyncState<T> {
  return {
    url,
    snapshot,
    attempted: true,
    lastAttemptFailed: false,
    lastAttemptAt: info.lastAttemptAt,
    lastSuccessAt: new Date(info.receivedAtMs).toISOString(),
    ageAtReceiptMs: info.ageAtReceiptMs,
    receivedAtMs: info.receivedAtMs,
  };
}

/** A failed attempt keeps the last snapshot only if it belongs to the same query. */
export function syncFailed<T>(prev: SyncState<T>, url: string, lastAttemptAt: string): SyncState<T> {
  const base = syncStateFor(prev, url);
  return { ...base, attempted: true, lastAttemptFailed: true, lastAttemptAt };
}
