/**
 * Pure authorization rules (no I/O, testable). AURELIS is single-user: any
 * valid, non-anonymous Supabase session is the owner (public sign-up is
 * disabled in Supabase). Identity comes only from claims verified by
 * getClaims(), never from getSession().
 */

export type AuthCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "unavailable" };

/** Shape of `supabase.auth.getClaims()` that matters here. */
export interface ClaimsResult {
  data: { claims: Record<string, unknown> | null | undefined } | null;
  error: { name?: string; status?: number } | null;
}

/** Verified claims → identity. Only the user id leaves this function (no tokens, no email). */
export function evaluateClaims(result: ClaimsResult | null): AuthCheck {
  if (!result) return { ok: false, reason: "unavailable" };
  const claims = result.data?.claims;
  if (result.error || !claims) return { ok: false, reason: "unauthenticated" };
  const sub = claims.sub;
  if (typeof sub !== "string" || !sub) return { ok: false, reason: "unauthenticated" };
  if (claims.role !== "authenticated" || claims.is_anonymous === true) return { ok: false, reason: "unauthenticated" };
  return { ok: true, userId: sub };
}

/** Small fixed body; nothing about why (no token, cookie or Supabase detail). */
export function authErrorResponse(check: Extract<AuthCheck, { ok: false }>): Response {
  const unavailable = check.reason === "unavailable";
  return new Response(JSON.stringify({ error: unavailable ? "AUTH_UNAVAILABLE" : "UNAUTHORIZED" }), {
    status: unavailable ? 503 : 401,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** `/` (temporary, until the public landing exists). */
export const rootDestination = (check: AuthCheck) => (check.ok ? "/app" : "/login");
/** `/login`: an authenticated visitor never sees the form again. */
export const loginRedirect = (check: AuthCheck) => (check.ok ? "/app" : null);
/** `/app`: private. */
export const appRedirect = (check: AuthCheck) => (check.ok ? null : "/login");

/**
 * Login failure → fixed, sanitized UI text. Wrong password, unknown email,
 * unconfirmed email… all read the same (never reveal whether an account exists);
 * only an unreachable / overloaded auth service is distinguished.
 */
export function loginFailure(error: { status?: number } | null | undefined): { title: string; detail: string } {
  const status = error?.status ?? 0;
  if (status >= 400 && status < 500 && status !== 429) return { title: "ACCESS DENIED", detail: "Invalid credentials." };
  return { title: "AUTH UNAVAILABLE", detail: "Try again shortly." };
}

/** Errors worth a log line (a missing session is the normal unauthenticated case). */
export const isUnexpectedAuthError = (error: { name?: string } | null) =>
  !!error && error.name !== "AuthSessionMissingError";
