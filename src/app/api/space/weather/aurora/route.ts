import type { AuroraForecastFeed } from "@/types";
import { fetchAuroraForecast } from "@/lib/sources/noaa/ovation";
import { requireAuth } from "@/lib/auth";

/**
 * Latest NOAA SWPC OVATION aurora forecast in the AURELIS model (not raw SWPC
 * JSON). Only non-zero grid cells are sent (counts of all cells are kept), so
 * the response is a fraction of the ~0.9 MB upstream file.
 *
 * Minimal module-level cache: at most one upstream call every
 * MIN_FETCH_INTERVAL_MS across all clients, concurrent requests share the
 * in-flight call, failures are not kept (the next request retries; an old
 * forecast is never re-served as current). No client input reaches the upstream URL.
 */
const MIN_FETCH_INTERVAL_MS = 4 * 60_000;

let latest: { feed: AuroraForecastFeed; fetchedAtMs: number } | null = null;
let inFlight: Promise<AuroraForecastFeed> | null = null;

function getAurora(): Promise<AuroraForecastFeed> {
  if (latest && Date.now() - latest.fetchedAtMs < MIN_FETCH_INTERVAL_MS) {
    return Promise.resolve(latest.feed);
  }
  inFlight ??= fetchAuroraForecast()
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
    return Response.json(await getAurora());
  } catch (error) {
    console.error("[api/space/weather/aurora] NOAA SWPC OVATION unavailable:", error);
    return Response.json({ error: "NOAA SWPC OVATION aurora forecast unavailable" }, { status: 502 });
  }
}
