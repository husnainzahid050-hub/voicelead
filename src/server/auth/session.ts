import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { userRoleSchema } from "@/lib/validation";
import {
  cookieMaxAgeSeconds,
  generateSessionToken,
  hashSessionToken,
  isExpired,
  isWellFormedToken,
  nextExpiry,
  shouldExtend,
} from "./session-core";
import type { AuthUser } from "./types";

const isProd = env.NODE_ENV === "production";

export type SessionLookup =
  | { status: "valid"; user: AuthUser }
  | { status: "missing" }
  /** A cookie exists but no live session matches it (expired or revoked). */
  | { status: "invalid" };

async function readToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Create a session for `userId` and set the cookie. Server Actions / Route Handlers only. */
export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const now = new Date();
  await db.session.create({
    data: {
      id: hashSessionToken(token, env.SESSION_SECRET),
      userId,
      createdAt: now,
      expiresAt: nextExpiry(now, now),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax", // "strict" would sign staff out when opening the dashboard from WhatsApp
    path: "/",
    maxAge: cookieMaxAgeSeconds(),
  });
}

/** Resolve the current session. Safe to call from Server Components. */
export async function lookupSession(): Promise<SessionLookup> {
  const token = await readToken();
  if (token === undefined) return { status: "missing" };
  if (!isWellFormedToken(token)) return { status: "invalid" };

  const id = hashSessionToken(token, env.SESSION_SECRET);
  const session = await db.session.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true, businessId: true } },
    },
  });
  if (!session) return { status: "invalid" };

  const now = new Date();
  if (isExpired(session.expiresAt, now)) {
    await db.session.delete({ where: { id } }).catch(() => undefined);
    return { status: "invalid" };
  }

  const role = userRoleSchema.safeParse(session.user.role);
  if (!role.success) return { status: "invalid" }; // corrupt role: deny rather than guess

  if (shouldExtend(session.expiresAt, session.createdAt, now)) {
    await db.session.update({
      where: { id },
      data: { expiresAt: nextExpiry(session.createdAt, now) },
    });
  }

  return {
    status: "valid",
    user: { ...session.user, role: role.data },
  };
}

/** Delete the current session row and cookie. Server Actions / Route Handlers only. */
export async function destroySession(): Promise<void> {
  const token = await readToken();
  if (isWellFormedToken(token)) {
    await db.session
      .delete({ where: { id: hashSessionToken(token, env.SESSION_SECRET) } })
      .catch(() => undefined); // already gone is fine
  }
  // Overwrite with identical attributes: browsers ignore changes to a
  // `__Host-` cookie unless they carry Secure + Path=/, which a bare
  // cookies().delete() does not send.
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Revoke every session for a user ("sign out everywhere", password change).
 * Not used on sign-in: rotating the current session already prevents
 * fixation, and killing other devices would surprise the user.
 */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
