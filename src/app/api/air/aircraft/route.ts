import { gzipSync } from "node:zlib";
import { OpenSkyAuthError } from "@/lib/sources/opensky/auth";
import { OpenSkyRateLimitError, buildAirTrafficFeed, fetchGlobalStates } from "@/lib/sources/opensky/states";
import { AIR_POLL_MS } from "@/lib/sources/opensky/source";
import { requireAuth } from "@/lib/auth";

/**
 * Current GLOBAL OpenSky snapshot (one /states/all request, no bounding box)
 * in the AURELIS model: compact rows of aircraft with a current position
 * (types/air.ts). The browser never sees OpenSky credentials or tokens; it
 * calls this route only while AIR is active (see useAirTraffic).
 *
 * Quota protection (4 credits per global request; 4 000/day standard account):
 * - one upstream request per AIR_POLL_MS − 5 s at most, shared by every client;
 * - after a 429, no upstream call until OpenSky's retry-after has passed.
 * The response (~1.4 MB JSON for ~12 000 aircraft) is gzip-compressed once per
 * snapshot when the client accepts it. Errors carry only a fixed message.
 */
const MIN_FETCH_INTERVAL_MS = AIR_POLL_MS - 5_000;

let latest: { json: string; gzip: Uint8Array; fetchedAtMs: number } | null = null;
let inFlight: Promise<{ json: string; gzip: Uint8Array; fetchedAtMs: number }> | null = null;
let blockedUntilMs = 0;
let previous: { remaining: number; atMs: number } | null = null;

function getSnapshot() {
  if (latest && Date.now() - latest.fetchedAtMs < MIN_FETCH_INTERVAL_MS) return Promise.resolve(latest);
  if (Date.now() < blockedUntilMs) return Promise.reject(new OpenSkyRateLimitError(null));
  inFlight ??= fetchGlobalStates()
    .then((response) => {
      const now = Date.now();
      // Cost seen between two consecutive requests of this server (other clients of the same account would inflate it).
      const delta =
        previous && response.creditsRemaining !== null && now - previous.atMs < 10 * 60_000
          ? previous.remaining - response.creditsRemaining
          : null;
      if (response.creditsRemaining !== null) previous = { remaining: response.creditsRemaining, atMs: now };
      const feed = buildAirTrafficFeed(response, new Date(now).toISOString(), delta !== null && delta > 0 ? delta : null);
      const json = JSON.stringify(feed);
      latest = { json, gzip: gzipSync(json), fetchedAtMs: now };
      return latest;
    })
    .catch((error: unknown) => {
      if (error instanceof OpenSkyRateLimitError) blockedUntilMs = Date.now() + (error.retryAfterS ?? 15 * 60) * 1000;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const snapshot = await getSnapshot();
    const acceptsGzip = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
    return new Response(acceptsGzip ? new Uint8Array(snapshot.gzip) : snapshot.json, {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        vary: "accept-encoding",
        ...(acceptsGzip ? { "content-encoding": "gzip" } : {}),
      },
    });
  } catch (error) {
    if (error instanceof OpenSkyRateLimitError) {
      console.warn("[api/air/aircraft] OpenSky rate limit reached; paused until retry-after");
      return Response.json({ error: "OpenSky rate limit reached; retrying later" }, { status: 429 });
    }
    if (error instanceof OpenSkyAuthError) {
      // Fixed message only (status codes, never credentials or tokens).
      console.error("[api/air/aircraft] OpenSky authentication failed:", error.message);
      return Response.json(
        { error: error.configured ? "OpenSky authentication failed" : "OpenSky credentials not configured on the server" },
        { status: error.configured ? 502 : 503 },
      );
    }
    console.error("[api/air/aircraft] OpenSky unavailable:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "OpenSky aircraft states unavailable" }, { status: 502 });
  }
}
