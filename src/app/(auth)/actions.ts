"use server";

import { redirect } from "next/navigation";
import { actionError, formText, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { AUTH_RATE_LIMITS } from "@/lib/constants";
import { safeNextPath } from "@/lib/safe-redirect";
import { signInSchema, signUpSchema } from "@/lib/schemas/auth";
import { getCurrentUser } from "@/server/auth/guards";
import { createSession, destroySession } from "@/server/auth/session";
import {
  clearRateLimit,
  consume,
  describeRetry,
  isRateLimited,
  recordHit,
} from "@/server/rate-limit";
import { writeAudit } from "@/server/repositories/audit";
import { getClientIpHash, hmac } from "@/server/request";
import { registerOwner, verifyCredentials } from "@/server/services/auth";

const CHECK_FIELDS = "Please check the highlighted fields.";

export async function signInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formText(fd, "email"),
    password: formText(fd, "password"),
  });
  if (!parsed.success) return actionError(CHECK_FIELDS, zodFieldErrors(parsed.error));

  const ipHash = await getClientIpHash();
  const emailKey = `signin:email:${hmac(parsed.data.email)}`;
  const ipKey = `signin:ip:${ipHash}`;

  const [byEmail, byIp] = await Promise.all([
    isRateLimited(emailKey, AUTH_RATE_LIMITS.signInPerEmail),
    isRateLimited(ipKey, AUTH_RATE_LIMITS.signInPerIp),
  ]);
  if (byEmail.limited || byIp.limited) {
    const wait = Math.max(byEmail.retryAfterSeconds, byIp.retryAfterSeconds);
    return actionError(`Too many sign-in attempts. Please try again in ${describeRetry(wait)}.`);
  }

  const result = await verifyCredentials(parsed.data);
  if (!result.ok) {
    // Only failures count, so a busy clinic signing in often is never locked out.
    await Promise.all([
      recordHit(emailKey, AUTH_RATE_LIMITS.signInPerEmail),
      recordHit(ipKey, AUTH_RATE_LIMITS.signInPerIp),
    ]);
    return actionError("Email or password is incorrect.");
  }

  await clearRateLimit(emailKey);
  await destroySession(); // rotate: never reuse a session that existed before sign-in
  await createSession(result.userId);
  if (result.businessId) {
    await writeAudit({
      businessId: result.businessId,
      userId: result.userId,
      action: "auth.signed_in",
      ipHash,
    });
  }

  const next = safeNextPath(formText(fd, "next"));
  // The client performs a full page load to this path (see SignInForm): Next.js
  // keeps visited pages alive but hidden, and a hard load guarantees nothing
  // from a previous user's session remains in this tab.
  return {
    status: "success",
    redirectTo: result.businessId ? (next ?? "/dashboard") : "/onboarding",
  };
}

export async function signUpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    name: formText(fd, "name"),
    email: formText(fd, "email"),
    password: formText(fd, "password"),
  });
  if (!parsed.success) return actionError(CHECK_FIELDS, zodFieldErrors(parsed.error));

  const ipHash = await getClientIpHash();
  const limit = await consume(`signup:ip:${ipHash}`, AUTH_RATE_LIMITS.signUpPerIp);
  if (limit.limited) {
    return actionError(
      `Too many accounts created from this network. Please try again in ${describeRetry(limit.retryAfterSeconds)}.`,
    );
  }

  const result = await registerOwner(parsed.data);
  if (!result.ok) {
    return actionError(CHECK_FIELDS, {
      email: "An account with this email already exists. Try signing in instead.",
    });
  }

  await destroySession();
  await createSession(result.userId);
  redirect("/onboarding");
}

/**
 * Ends the session. Does not redirect: the caller (SignOutButton) does a full
 * page load afterwards so hidden, preserved pages — which may contain patient
 * data — are discarded on shared reception computers.
 */
export async function signOutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user?.businessId) {
    await writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: "auth.signed_out",
      ipHash: await getClientIpHash(),
    });
  }
}
