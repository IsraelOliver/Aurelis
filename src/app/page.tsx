import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { rootDestination } from "@/lib/auth-core";

/**
 * Temporary root: authenticated → /app, otherwise → /login.
 * Reserved for the future public landing/portfolio.
 */
export default async function Home() {
  redirect(rootDestination(await verifyAuth()));
}
