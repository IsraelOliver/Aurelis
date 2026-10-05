import type { IssFeed } from "@/types";
import { fetchIssPosition } from "@/lib/sources/wtia/iss";

/**
 * Current ISS position in the AURELIS model (not raw Where The ISS At? JSON).
 *
 * Not unstable_cache: it is stale-while-revalidate and would serve old
 * positions of an object moving ~7.7 km/s. Instead, a minimal dedupe in this
 * module: at most one upstream call every MIN_FETCH_INTERVAL_MS across all
 * clients, concurrent requests share the in-flight call, failures are not kept.
 * That caps upstream use at ~75 calls / 5 min (limit: 350 / 5 min) and keeps
 * a served position at most ~4 s old.
 * No client input reaches the upstream URL.
 */
const MIN_FETCH_INTERVAL_MS = 4_000;

let latest: { feed: IssFeed; fetchedAtMs: number } | null = null;
let inFlight: Promise<IssFeed> | null = null;

function getIss(): Promise<IssFeed> {
  if (latest && Date.now() - latest.fetchedAtMs < MIN_FETCH_INTERVAL_MS) {
    return Promise.resolve(latest.feed);
  }
  inFlight ??= fetchIssPosition()
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
  try {
    return Response.json(await getIss());
  } catch (error) {
    console.error("[api/space/iss] ISS position unavailable:", error);
    return Response.json({ error: "ISS position unavailable" }, { status: 502 });
  }
}
