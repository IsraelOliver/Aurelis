import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

/**
 * Session refresh for every matched request (official @supabase/ssr proxy
 * pattern). This ONLY keeps the cookie session fresh for SSR; authorization
 * is enforced where the data is: pages and Route Handlers call getClaims()
 * through lib/auth.ts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Not configured: nothing to refresh (pages and APIs report auth unavailable).
  const env = supabaseEnv();
  if (!env) return supabaseResponse;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        // Responses that set auth cookies must never be cached (library-provided headers).
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out. getClaims() validates the token and refreshes it when
  // it is close to expiring.
  await supabase.auth.getClaims();

  // IMPORTANT: return the supabaseResponse object as it is, so refreshed cookies
  // (and their no-cache headers) reach the browser.
  return supabaseResponse;
}
