import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { loginRedirect } from "@/lib/auth-core";
import LoginScreen from "./LoginScreen";

export const metadata: Metadata = { title: "AURELIS · Authorized access" };

/** Public. An authenticated visitor goes straight to /app. */
export default async function LoginPage() {
  const check = await verifyAuth();
  const to = loginRedirect(check);
  if (to) redirect(to);
  return <LoginScreen unavailable={!check.ok && check.reason === "unavailable"} />;
}
