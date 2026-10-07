import { dedupedFetcher } from "@/lib/deduped-fetch";
import { getGfsCloudField, selectGfsCloudField } from "@/lib/sources/noaa/gfs-clouds";
import type { CloudCoverFeed } from "@/types";

/**
 * Current GFS total cloud cover field (metadata only; the grid is at
 * feed.grid.url). Picks the newest published run and, in it, the hourly step
 * whose valid time is closest to now; the field is downloaded and fully
 * validated BEFORE it is announced, so a client only ever switches to a grid
 * that exists. At most one upstream check every 10 min across all clients
 * (runs appear four times a day, steps change hourly); failures are not kept.
 * No client input reaches the upstream URL.
 */
const MIN_CHECK_INTERVAL_MS = 10 * 60_000;

const getCurrent = dedupedFetcher(async (): Promise<CloudCoverFeed> => {
  const now = Date.now();
  const field = await getGfsCloudField(await selectGfsCloudField(now));
  return { ...field.feed, metadata: { ...field.feed.metadata, checkedAt: new Date(now).toISOString() } };
}, MIN_CHECK_INTERVAL_MS);

export async function GET() {
  try {
    return Response.json(await getCurrent(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[api/weather/clouds] NOAA GFS cloud cover unavailable:", error);
    return Response.json({ error: "NOAA GFS cloud cover unavailable" }, { status: 502 });
  }
}
