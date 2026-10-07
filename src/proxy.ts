import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/** Next.js 16 Proxy (formerly middleware): keeps the Supabase cookie session fresh. */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Every request path except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico and image files (icon.png, apple-icon.png…)
     * - vendor/ and map-styles/ (public map assets: MapLibre worker, basemap style)
     */
    "/((?!_next/static|_next/image|favicon.ico|vendor/|map-styles/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
