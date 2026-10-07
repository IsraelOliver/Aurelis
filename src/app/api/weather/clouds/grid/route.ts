import { getGfsCloudFieldById } from "@/lib/sources/noaa/gfs-clouds";
import { parseGfsFieldId } from "@/lib/sources/noaa/gfs-source";
import { requireAuth } from "@/lib/auth";

/**
 * Binary grid of one GFS cloud cover field (layout in CloudCoverGridInfo):
 * ?id=YYYYMMDDCC-fFFF. The content of an id never changes, so it is cacheable.
 * Only strictly valid ids of the last two days are accepted (the id is the
 * only client input; it is parsed, never forwarded as text).
 */
const MAX_RUN_AGE_MS = 48 * 3_600_000;

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = parseGfsFieldId(new URL(request.url).searchParams.get("id") ?? "");
  const age = parsed ? Date.now() - parsed.run.timeMs : NaN;
  if (!parsed || !(age >= 0 && age <= MAX_RUN_AGE_MS)) {
    return Response.json({ error: "id must be a recent GFS run and hourly step, e.g. 2026100612-f008" }, { status: 400 });
  }
  try {
    const field = await getGfsCloudFieldById(parsed.run, parsed.forecastHour);
    const acceptsGzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
    const body = acceptsGzip ? field.gzip : field.body;
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "public, max-age=86400, immutable",
        vary: "accept-encoding",
        ...(acceptsGzip ? { "content-encoding": "gzip" } : {}),
      },
    });
  } catch (error) {
    console.error("[api/weather/clouds/grid] NOAA GFS cloud grid unavailable:", error);
    return Response.json({ error: "NOAA GFS cloud grid unavailable" }, { status: 502 });
  }
}
