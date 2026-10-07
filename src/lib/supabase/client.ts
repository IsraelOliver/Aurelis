import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Browser client (official @supabase/ssr pattern): the session lives in
 * cookies managed by the library, never in custom storage. Null when the
 * project is not configured (the login screen then reports auth unavailable).
 */
export function createClient() {
  const env = supabaseEnv();
  return env ? createBrowserClient(env.url, env.key) : null;
}
