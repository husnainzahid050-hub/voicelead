import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** HMAC so raw IPs and emails are never stored (audit log, rate-limit keys). */
export function hmac(value: string): string {
  return createHmac("sha256", env.IP_HASH_SECRET).update(value).digest("hex");
}

/**
 * The unit an attacker can't cheaply multiply: the full address for IPv4,
 * but only the /64 prefix for IPv6 (one home connection usually owns 2^64
 * addresses, so per-address limits would be trivial to rotate around).
 */
export function rateLimitSubject(ip: string): string {
  const addr = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "");
  if (!addr.includes(":")) return addr;
  if (addr.startsWith("::ffff:") && addr.includes(".")) return addr.slice(7); // IPv4-mapped
  const [head = "", tail = ""] = addr.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = addr.includes("::") ? 8 - headParts.length - tailParts.length : 0;
  const full = [...headParts, ...Array<string>(Math.max(0, missing)).fill("0"), ...tailParts];
  return `${full
    .slice(0, 4)
    .map((p) => p.padStart(4, "0"))
    .join(":")}::/64`;
}

/**
 * Client IP, hashed. On Vercel `x-forwarded-for` is set by the platform;
 * the first entry is the client. Locally it may be absent.
 */
export async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return hmac(`ip:${rateLimitSubject(ip)}`);
}
