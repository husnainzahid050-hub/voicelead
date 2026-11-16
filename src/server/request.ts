import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** HMAC so raw IPs and emails are never stored (audit log, rate-limit keys). */
export function hmac(value: string): string {
  return createHmac("sha256", env.IP_HASH_SECRET).update(value).digest("hex");
}

/**
 * Client IP, hashed. On Vercel `x-forwarded-for` is set by the platform;
 * the first entry is the client. Locally it may be absent.
 */
export async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return hmac(`ip:${ip}`);
}
