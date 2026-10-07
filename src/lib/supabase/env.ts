/**
 * Supabase project URL and publishable key: public by design (they identify
 * the project; access is enforced by Supabase Auth). Read as literal
 * `process.env.NEXT_PUBLIC_*` so Next.js inlines them in the browser bundle.
 * Missing values mean "auth unavailable" at runtime, never a build failure.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
