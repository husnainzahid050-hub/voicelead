import "server-only";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limiter backed by the RateLimit table, so limits hold
 * across serverless instances. Keys must already be hashed (see hmac in ./request).
 *
 * Counting is a single atomic `INSERT … ON CONFLICT … RETURNING` statement:
 * parallel requests cannot all read "under the limit" before any is counted.
 * Swap for Redis/Upstash behind this interface at higher scale.
 */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

interface CounterRow {
  count: number;
  windowEnd: Date;
}

/** Atomically count one event; starts a new window if the old one ended. */
async function increment(key: string, rule: RateLimitRule): Promise<CounterRow> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + rule.windowMs);
  const rows = await db.$queryRaw<CounterRow[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowEnd")
    VALUES (${key}, 1, ${windowEnd})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowEnd" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowEnd" = CASE WHEN "RateLimit"."windowEnd" <= ${now} THEN EXCLUDED."windowEnd" ELSE "RateLimit"."windowEnd" END
    RETURNING "count", "windowEnd"`;
  const row = rows[0];
  if (!row) throw new Error("rate limit counter missing");
  // Housekeeping on ~2% of writes: remove windows that ended over a day ago.
  if (Math.random() < 0.02) {
    await db.rateLimit
      .deleteMany({ where: { windowEnd: { lt: new Date(now.getTime() - 86_400_000) } } })
      .catch(() => undefined);
  }
  return { count: Number(row.count), windowEnd: new Date(row.windowEnd) };
}

function retryAfter(windowEnd: Date): number {
  return Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));
}

/**
 * Count this attempt and say whether it is allowed. The attempt is counted
 * BEFORE the expensive work happens, so bursts are limited too.
 * Allowed while count <= limit.
 */
export async function consume(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const row = await increment(key, rule);
  const limited = row.count > rule.limit;
  return { limited, retryAfterSeconds: limited ? retryAfter(row.windowEnd) : 0 };
}

/** Read-only check: is this key currently over its limit? */
export async function isRateLimited(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowEnd.getTime() <= Date.now())
    return { limited: false, retryAfterSeconds: 0 };
  const limited = row.count >= rule.limit;
  return { limited, retryAfterSeconds: limited ? retryAfter(row.windowEnd) : 0 };
}

/** Count one event; reports whether the key has now reached its limit. */
export async function recordHit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const row = await increment(key, rule);
  const limited = row.count >= rule.limit;
  return { limited, retryAfterSeconds: limited ? retryAfter(row.windowEnd) : 0 };
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Human wording for a retry delay. */
export function describeRetry(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
