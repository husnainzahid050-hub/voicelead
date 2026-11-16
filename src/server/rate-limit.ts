import "server-only";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limiter backed by the RateLimit table, so limits hold
 * across serverless instances. Swap for Upstash/Redis behind this interface
 * at higher scale. Keys must already be hashed (see hmac in ./request).
 */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/** Read-only check: is this key currently over its limit? */
export async function isRateLimited(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  const now = Date.now();
  if (!row || row.windowEnd.getTime() <= now) return { limited: false, retryAfterSeconds: 0 };
  const limited = row.count >= rule.limit;
  return {
    limited,
    retryAfterSeconds: limited ? Math.ceil((row.windowEnd.getTime() - now) / 1000) : 0,
  };
}

/** Count one event against `key`. Returns whether the key is now over its limit. */
export async function recordHit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = new Date();
  // Housekeeping on ~2% of writes: remove windows that ended over a day ago.
  if (Math.random() < 0.02) {
    await db.rateLimit
      .deleteMany({ where: { windowEnd: { lt: new Date(now.getTime() - 86_400_000) } } })
      .catch(() => undefined);
  }
  const row = await db.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.windowEnd <= now) {
      return tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowEnd: new Date(now.getTime() + rule.windowMs) },
        update: { count: 1, windowEnd: new Date(now.getTime() + rule.windowMs) },
      });
    }
    return tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  });
  const limited = row.count >= rule.limit;
  return {
    limited,
    retryAfterSeconds: limited ? Math.ceil((row.windowEnd.getTime() - now.getTime()) / 1000) : 0,
  };
}

/** Check-and-count in one call, for endpoints where every attempt counts. */
export async function consume(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const current = await isRateLimited(key, rule);
  if (current.limited) return current;
  await recordHit(key, rule);
  return { limited: false, retryAfterSeconds: 0 };
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Human wording for a retry delay. */
export function describeRetry(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
