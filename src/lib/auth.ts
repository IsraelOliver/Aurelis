import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  appRedirect,
  authErrorResponse,
  evaluateClaims,
  isUnexpectedAuthError,
  type AuthCheck,
  type ClaimsResult,
} from "./auth-core";

/**
 * Server-side authorization for pages and Route Handlers. Validates the
 * cookie session with supabase.auth.getClaims() (verifies the JWT; refreshes
 * it when close to expiry) — never getSession(), which is not revalidated.
 * Logs carry only the error name and status: never tokens, cookies or headers.
 */
export async function verifyAuth(): Promise<AuthCheck> {
  const supabase = await createClient();
  if (!supabase) return evaluateClaims(null);
  try {
    const result = (await supabase.auth.getClaims()) as ClaimsResult;
    if (isUnexpectedAuthError(result.error)) {
      console.warn(`[AUTH] claims check failed: ${result.error?.name ?? "error"} status=${result.error?.status ?? "-"}`);
    }
    return evaluateClaims(result);
  } catch (error) {
    console.warn(`[AUTH] claims check failed: ${error instanceof Error ? error.name : "unknown"}`);
    return { ok: false, reason: "unauthenticated" };
  }
}

/**
 * Route Handlers: first statement of every AURELIS API handler, before any
 * upstream call (OpenAI, OpenSky, NOAA, NASA, USGS…).
 *   const auth = await requireAuth();
 *   if (!auth.ok) return auth.response;
 */
export async function requireAuth(): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const check = await verifyAuth();
  return check.ok ? check : { ok: false, response: authErrorResponse(check) };
}

/** Private pages: unauthenticated → /login (the page never renders). */
export async function requirePageAuth(): Promise<{ userId: string }> {
  const check = await verifyAuth();
  const to = appRedirect(check);
  if (to || !check.ok) redirect(to ?? "/login");
  return { userId: check.userId };
}
