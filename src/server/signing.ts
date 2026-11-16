import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * Small signed tokens (HMAC-SHA256), used where the server hands data to the
 * browser and must later trust it unchanged:
 *   - "intake":     proves a request comes from a freshly loaded intake page
 *   - "extraction": the AI's reading of a conversation, so customers can edit
 *                   their own details but cannot forge urgency or confidence
 * Each purpose uses its own derived key, so tokens are not interchangeable.
 */
export type TokenPurpose = "intake" | "extraction";

function keyFor(purpose: TokenPurpose): Buffer {
  return createHmac("sha256", env.SESSION_SECRET).update(`voicelead:token:v1:${purpose}`).digest();
}

export function signToken(purpose: TokenPurpose, data: unknown, ttlSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({ d: data, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  const sig = createHmac("sha256", keyFor(purpose)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type VerifyResult<T> = { ok: true; data: T } | { ok: false; reason: "invalid" | "expired" };

export function verifyToken<T>(
  purpose: TokenPurpose,
  token: string | null | undefined,
  schema: z.ZodType<T>,
): VerifyResult<T> {
  if (!token || token.length > 16_000) return { ok: false, reason: "invalid" };
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return { ok: false, reason: "invalid" };

  const expected = createHmac("sha256", keyFor(purpose)).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "invalid" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const envelope = parsed as { d?: unknown; exp?: unknown };
  if (typeof envelope.exp !== "number") return { ok: false, reason: "invalid" };
  if (envelope.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  const data = schema.safeParse(envelope.d);
  return data.success ? { ok: true, data: data.data } : { ok: false, reason: "invalid" };
}
