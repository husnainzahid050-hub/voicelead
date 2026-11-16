import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNextPath } from "@/lib/safe-redirect";
import { lookupSession, type SessionLookup } from "./session";
import type { AuthContext, AuthUser } from "./types";

/** One session lookup per request, however many components ask. */
const getSessionLookup = cache((): Promise<SessionLookup> => lookupSession());

export async function getCurrentUser(): Promise<AuthUser | null> {
  const lookup = await getSessionLookup();
  return lookup.status === "valid" ? lookup.user : null;
}

/** Signed-in user (may not have a clinic yet). Redirects to sign-in otherwise. */
export async function requireUser(): Promise<AuthUser> {
  const lookup = await getSessionLookup();
  if (lookup.status === "valid") return lookup.user;

  // proxy.ts forwards the requested path so we can come back after sign-in.
  const next = safeNextPath((await headers()).get("x-vl-pathname"));
  const params = new URLSearchParams();
  if (lookup.status === "invalid") params.set("reason", "expired");
  if (next) params.set("next", next);
  const query = params.toString();
  redirect(query ? `/sign-in?${query}` : "/sign-in");
}

/** Signed-in user who belongs to a clinic. Sends users without one to onboarding. */
export async function requireBusinessUser(): Promise<AuthUser & AuthContext> {
  const user = await requireUser();
  if (!user.businessId) redirect("/onboarding");
  return { ...user, userId: user.id, businessId: user.businessId };
}

/** Narrow an AuthUser to the minimal context repositories accept. */
export function toAuthContext(user: AuthUser & AuthContext): AuthContext {
  return { userId: user.userId, businessId: user.businessId, role: user.role };
}
