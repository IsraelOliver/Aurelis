/**
 * Server-side module cache used by internal routes: at most one upstream call
 * every `minIntervalMs` across all clients; concurrent requests share the
 * in-flight call; failures are never kept (the next request retries, so old
 * data is never re-served as current).
 */
export function dedupedFetcher<T>(fetchFn: () => Promise<T>, minIntervalMs: number): () => Promise<T> {
  let latest: { value: T; fetchedAtMs: number } | null = null;
  let inFlight: Promise<T> | null = null;
  return () => {
    if (latest && Date.now() - latest.fetchedAtMs < minIntervalMs) {
      return Promise.resolve(latest.value);
    }
    inFlight ??= fetchFn()
      .then((value) => {
        latest = { value, fetchedAtMs: Date.now() };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}
