import { OPENSKY_TOKEN_URL } from "./source";

/**
 * OpenSky OAuth2 client credentials (SERVER ONLY: imported only by the
 * /api/air route). Reads OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET from the
 * server environment; never NEXT_PUBLIC_*, never sent to the browser.
 *
 * - The access token lives only in this module's memory, with its expiry
 *   from the response's `expires_in` (the authority), renewed early by a
 *   safety margin.
 * - Concurrent callers share one in-flight token request.
 * - Errors and logs carry only an HTTP status or a fixed message: never the
 *   client id/secret, the token, the token response or an Authorization header.
 */

/** Renew this long before `expires_in` runs out (at most half the lifetime). */
const REFRESH_MARGIN_MS = 60_000;
const TOKEN_TIMEOUT_MS = 15_000;

export class OpenSkyAuthError extends Error {
  readonly configured: boolean;
  constructor(message: string, configured = true) {
    super(message);
    this.name = "OpenSkyAuthError";
    this.configured = configured;
  }
}

let cached: { token: string; renewAtMs: number } | null = null;
let inFlight: Promise<string> | null = null;

export const openSkyCredentialsConfigured = () =>
  Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);

async function requestToken(): Promise<{ token: string; renewAtMs: number }> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new OpenSkyAuthError("OpenSky credentials are not configured on the server", false);
  let res: Response;
  try {
    res = await fetch(OPENSKY_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch {
    throw new OpenSkyAuthError("OpenSky token endpoint unreachable");
  }
  // Status only: the response body is never read into an error or a log.
  if (!res.ok) throw new OpenSkyAuthError(`OpenSky token endpoint HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  const token = body?.access_token;
  const expiresInMs = Number(body?.expires_in) * 1000;
  if (typeof token !== "string" || token === "" || !Number.isFinite(expiresInMs) || expiresInMs <= 0) {
    throw new OpenSkyAuthError("OpenSky token response malformed");
  }
  return { token, renewAtMs: Date.now() + expiresInMs - Math.min(REFRESH_MARGIN_MS, expiresInMs / 2) };
}

/** A valid access token: the cached one, or one new request shared by concurrent callers. */
export function getOpenSkyToken(): Promise<string> {
  if (cached && Date.now() < cached.renewAtMs) return Promise.resolve(cached.token);
  inFlight ??= requestToken()
    .then((t) => {
      cached = t;
      return t.token;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Drops `token` after a 401 so the next call fetches a new one (a newer token is kept). */
export function invalidateOpenSkyToken(token: string): void {
  if (cached?.token === token) cached = null;
}
