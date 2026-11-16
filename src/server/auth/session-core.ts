import { createHmac, randomBytes } from "node:crypto";
import { LIMITS } from "@/lib/constants";

/**
 * Pure session logic (no cookies, no database) so it can be unit tested.
 *
 * Model:
 * - The browser holds a random 256-bit token in an HttpOnly cookie.
 * - The database stores only HMAC-SHA256(token, SESSION_SECRET) as Session.id,
 *   so a database leak alone cannot be replayed as a login.
 * - Idle timeout slides (7 days); absolute lifetime is capped (30 days).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_MS = LIMITS.sessionDays * DAY_MS;
const ABSOLUTE_MS = LIMITS.sessionAbsoluteDays * DAY_MS;

/** 32 random bytes → 43 base64url characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isWellFormedToken(token: string | undefined | null): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function hashSessionToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

/** New expiry: idle window from now, never beyond the absolute cap. */
export function nextExpiry(createdAt: Date, now: Date): Date {
  return new Date(Math.min(now.getTime() + IDLE_MS, createdAt.getTime() + ABSOLUTE_MS));
}

/** The cookie lives for the full absolute lifetime; the DB row is authoritative. */
export function cookieMaxAgeSeconds(): number {
  return Math.floor(ABSOLUTE_MS / 1000);
}

/** Extend once less than half of the idle window remains (avoids a write per request). */
export function shouldExtend(expiresAt: Date, createdAt: Date, now: Date): boolean {
  const remaining = expiresAt.getTime() - now.getTime();
  return remaining < IDLE_MS / 2 && nextExpiry(createdAt, now).getTime() > expiresAt.getTime();
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
