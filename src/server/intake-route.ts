import "server-only";
import type { NextResponse } from "next/server";
import type { IntakeErrorBody } from "@/lib/intake/types";
import { errorResponse, isSameOrigin } from "./http";
import { consume, type RateLimitRule } from "./rate-limit";
import { getClientIpHash } from "./request";
import { resolveIntakeBusiness, type IntakeBusiness } from "./services/intake";

export type IntakeContext = { business: IntakeBusiness; ipHash: string };

/**
 * Shared gate for every public intake endpoint, in order:
 *  1. same-origin check (CSRF)          3. signed page token → clinic (active)
 *  2. per-IP rate limit                 4. hashed client IP for audit
 */
export async function openIntakeRequest(
  request: Request,
  slug: string,
  limitName: string,
  rule: RateLimitRule,
  options: { allowInactive?: boolean } = {},
): Promise<
  { ok: true; ctx: IntakeContext } | { ok: false; response: NextResponse<IntakeErrorBody> }
> {
  if (!isSameOrigin(request)) return { ok: false, response: errorResponse("forbidden") };

  const ipHash = await getClientIpHash();
  const limit = await consume(`intake:${limitName}:${ipHash}`, rule);
  if (limit.limited) {
    return {
      ok: false,
      response: errorResponse("rate_limited", { retryAfterSeconds: limit.retryAfterSeconds }),
    };
  }

  const resolved = await resolveIntakeBusiness(
    request.headers.get("x-intake-token"),
    slug,
    options,
  );
  if (!resolved.ok) return { ok: false, response: errorResponse(resolved.code) };

  return { ok: true, ctx: { business: resolved.business, ipHash } };
}
