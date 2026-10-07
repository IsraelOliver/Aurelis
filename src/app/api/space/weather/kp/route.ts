import type { PlanetaryKpFeed } from "@/types";
import { fetchPlanetaryKp } from "@/lib/sources/noaa/swpc-kp";
import { requireAuth } from "@/lib/auth";

/**
 * NOAA SWPC planetary Kp in the AURELIS model (not raw SWPC JSON).
 *
 * The product updates every minute (served with max-age=60). A minimal
 * module-level cache: at most one upstream call every MIN_FETCH_INTERVAL_MS
 * across all clients, concurrent requests share the in-flight call, failures
 * are not kept (the next request retries, so old data is never re-served as
 * current). A served snapshot is at most ~45 s old.
 * No client input reaches the upstream URL.
 */
const MIN_FETCH_INTERVAL_MS = 45_000;

let latest: { feed: PlanetaryKpFeed; fetchedAtMs: number } | null = null;
let inFlight: Promise<PlanetaryKpFeed> | null = null;

function getKp(): Promise<PlanetaryKpFeed> {
  if (latest && Date.now() - latest.fetchedAtMs < MIN_FETCH_INTERVAL_MS) {
    return Promise.resolve(latest.feed);
  }
  inFlight ??= fetchPlanetaryKp()
    .then((feed) => {
      latest = { feed, fetchedAtMs: Date.now() };
      return feed;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    return Response.json(await getKp());
  } catch (error) {
    console.error("[api/space/weather/kp] NOAA SWPC Kp unavailable:", error);
    return Response.json({ error: "NOAA SWPC planetary Kp unavailable" }, { status: 502 });
  }
}
