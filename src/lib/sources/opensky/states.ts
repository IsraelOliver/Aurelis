import type { AircraftRow, AirTrafficFeed } from "@/types";
import { getOpenSkyToken, invalidateOpenSkyToken } from "./auth";
import { AIR_MAX_POSITION_AGE_S, OPENSKY_AIRCRAFT_SOURCE, OPENSKY_GLOBAL_CREDITS, OPENSKY_STATES_URL } from "./source";
import { dedupeByIcao24, parseOpenSkyStateVector, toAircraftRow, type ParsedStateVector } from "./state-vector";

/**
 * Global OpenSky snapshot (SERVER ONLY): ONE /states/all request without a
 * bounding box (never a tiling of boxes), authenticated with the OAuth2 token.
 * A 401 invalidates the token and retries ONCE with a new one.
 */

const REQUEST_TIMEOUT_MS = 30_000;

/** OpenSky answered 429: no credits left; `retryAfterS` from X-Rate-Limit-Retry-After-Seconds. */
export class OpenSkyRateLimitError extends Error {
  readonly retryAfterS: number | null;
  constructor(retryAfterS: number | null) {
    super("OpenSky rate limit reached");
    this.name = "OpenSkyRateLimitError";
    this.retryAfterS = retryAfterS;
  }
}

async function authorizedGet(url: string): Promise<Response> {
  const get = (token: string) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  const token = await getOpenSkyToken();
  const res = await get(token);
  if (res.status !== 401) return res;
  // Expired/revoked token: one renewal, one retry, no loop.
  invalidateOpenSkyToken(token);
  return get(await getOpenSkyToken());
}

export type GlobalStatesResponse = { timeS: number; raw: unknown[]; creditsRemaining: number | null };

/** One global /states/all request. */
export async function fetchGlobalStates(): Promise<GlobalStatesResponse> {
  const res = await authorizedGet(OPENSKY_STATES_URL);
  if (res.status === 429) {
    const retry = Number(res.headers.get("x-rate-limit-retry-after-seconds"));
    throw new OpenSkyRateLimitError(Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  if (!res.ok) throw new Error(`OpenSky states HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { time?: unknown; states?: unknown } | null;
  if (!body || typeof body.time !== "number" || !Number.isFinite(body.time)) throw new Error("OpenSky states response malformed");
  // `states` is null when no aircraft is known.
  if (body.states !== null && !Array.isArray(body.states)) throw new Error("OpenSky states field malformed");
  const remaining = Number(res.headers.get("x-rate-limit-remaining"));
  return {
    timeS: body.time,
    raw: (body.states as unknown[] | null) ?? [],
    creditsRemaining: res.headers.has("x-rate-limit-remaining") && Number.isFinite(remaining) ? remaining : null,
  };
}

/** The AURELIS feed of one global response (pure; also used by tests). */
export function buildAirTrafficFeed(
  response: GlobalStatesResponse,
  ingestedAt: string,
  observedCreditsPerRequest: number | null,
): AirTrafficFeed {
  const parsed: ParsedStateVector[] = [];
  let rejected = 0;
  for (const raw of response.raw) {
    const v = parseOpenSkyStateVector(raw);
    if (v) parsed.push(v);
    else rejected++;
  }
  const vectors = dedupeByIcao24(parsed);
  const aircraft: AircraftRow[] = [];
  let withoutPosition = 0;
  let stalePosition = 0;
  for (const v of vectors) {
    const row = toAircraftRow(v, response.timeS);
    if (row === "noPosition") withoutPosition++;
    else if (row === "stalePosition") stalePosition++;
    else aircraft.push(row);
  }
  return {
    source: OPENSKY_AIRCRAFT_SOURCE,
    scope: "global",
    aircraft,
    metadata: {
      ingestedAt,
      stateTime: new Date(response.timeS * 1000).toISOString(),
      totalStates: vectors.length,
      withoutPosition,
      stalePosition,
      maxPositionAgeS: AIR_MAX_POSITION_AGE_S,
      rejected,
      creditsRemaining: response.creditsRemaining,
      creditsPerRequest: OPENSKY_GLOBAL_CREDITS,
      observedCreditsPerRequest,
    },
  };
}
