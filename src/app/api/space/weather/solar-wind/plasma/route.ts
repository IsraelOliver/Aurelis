import { fetchSolarWindPlasma } from "@/lib/sources/noaa/rtsw";
import { dedupedFetcher } from "@/lib/deduped-fetch";

/**
 * NOAA SWPC RTSW plasma in the AURELIS model: active samples of the last
 * 6 h only (not the ~3 MB / 24 h upstream file). Independent of the magnetic
 * field route: its own fetch, cache, errors and health.
 * At most one upstream call every 45 s; failures are not cached.
 */
const getPlasma = dedupedFetcher(fetchSolarWindPlasma, 45_000);

export async function GET() {
  try {
    return Response.json(await getPlasma());
  } catch (error) {
    console.error("[api/space/weather/solar-wind/plasma] NOAA SWPC RTSW wind unavailable:", error);
    return Response.json({ error: "NOAA SWPC RTSW plasma unavailable" }, { status: 502 });
  }
}
