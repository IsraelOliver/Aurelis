import { gzipSync } from "node:zlib";
import type { EonetFeed } from "@/types";
import { fetchEonetOpenEvents } from "@/lib/sources/nasa/eonet";
import { dedupedFetcher } from "@/lib/deduped-fetch";
import { requireAuth } from "@/lib/auth";

/**
 * NASA EONET open natural events in the AURELIS model (Entities +
 * Observations; earthquakes excluded, USGS is used for those). At most one
 * upstream call every 4 min across all clients; failures are not cached.
 * No client input reaches the upstream URL.
 *
 * Thousands of open events (mostly wildfires) make the normalized JSON
 * several MB; it is gzip-compressed once per snapshot (when the client
 * accepts gzip), so the transfer stays well below the upstream file.
 */
const getEonet = dedupedFetcher(async () => {
  const feed = await fetchEonetOpenEvents();
  const json = JSON.stringify(feed);
  return { feed, json, gzip: gzipSync(json) };
}, 4 * 60_000);

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  let snapshot: { feed: EonetFeed; json: string; gzip: Buffer };
  try {
    snapshot = await getEonet();
  } catch (error) {
    console.error("[api/disasters/eonet] NASA EONET unavailable:", error);
    return Response.json({ error: "NASA EONET unavailable" }, { status: 502 });
  }
  const acceptsGzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
  return new Response(acceptsGzip ? new Uint8Array(snapshot.gzip) : snapshot.json, {
    headers: {
      "content-type": "application/json",
      vary: "accept-encoding",
      ...(acceptsGzip ? { "content-encoding": "gzip" } : {}),
    },
  });
}
