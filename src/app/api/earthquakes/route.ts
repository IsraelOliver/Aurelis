import { unstable_cache } from "next/cache";
import { fetchUsgsEarthquakes } from "@/lib/sources/usgs/earthquakes";
import { requireAuth } from "@/lib/auth";

/**
 * Normalized USGS earthquakes (AURELIS model, not raw USGS GeoJSON).
 * The whole normalized result is cached for 60 s (the feed updates every
 * minute and is served with max-age=60), so ingestedAt stays the moment the
 * server actually received the data. Failed fetches are not cached.
 * No client input reaches the upstream URL: it is fixed in the adapter.
 */
const getEarthquakes = unstable_cache(
  fetchUsgsEarthquakes,
  ["usgs-earthquakes-2.5-day"],
  { revalidate: 60 },
);

/**
 * unstable_cache is stale-while-revalidate: after an idle period, or while
 * USGS is failing, it keeps returning the last good result. Older than this,
 * fetch directly instead, so old data is never served as current.
 */
const MAX_AGE_MS = 120_000;

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    let feed = await getEarthquakes();
    if (Date.now() - Date.parse(feed.metadata.ingestedAt) > MAX_AGE_MS) {
      feed = await fetchUsgsEarthquakes();
    }
    return Response.json(feed);
  } catch (error) {
    console.error("[api/earthquakes] USGS feed unavailable:", error);
    return Response.json(
      { error: "USGS earthquake feed unavailable" },
      { status: 502 },
    );
  }
}
