import { fetchGoesXray } from "@/lib/sources/noaa/goes-xray";
import { dedupedFetcher } from "@/lib/deduped-fetch";
import { requireAuth } from "@/lib/auth";

/**
 * NOAA SWPC GOES X-ray (primary) in the AURELIS model: long-band flux of the
 * last 6 h + the latest official X-ray event. At most one upstream call every
 * 45 s; failures are not cached.
 */
const getXray = dedupedFetcher(fetchGoesXray, 45_000);

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    return Response.json(await getXray());
  } catch (error) {
    console.error("[api/space/weather/xray] NOAA SWPC GOES X-ray unavailable:", error);
    return Response.json({ error: "NOAA SWPC GOES X-ray unavailable" }, { status: 502 });
  }
}
