import { fetchInterplanetaryMagneticField } from "@/lib/sources/noaa/rtsw";
import { dedupedFetcher } from "@/lib/deduped-fetch";

/**
 * NOAA SWPC RTSW interplanetary magnetic field in the AURELIS model: active
 * samples of the last 6 h only. Independent of the plasma route: its own
 * fetch, cache, errors and health.
 * At most one upstream call every 45 s; failures are not cached.
 */
const getMag = dedupedFetcher(fetchInterplanetaryMagneticField, 45_000);

export async function GET() {
  try {
    return Response.json(await getMag());
  } catch (error) {
    console.error("[api/space/weather/solar-wind/mag] NOAA SWPC RTSW mag unavailable:", error);
    return Response.json({ error: "NOAA SWPC RTSW magnetic field unavailable" }, { status: 502 });
  }
}
