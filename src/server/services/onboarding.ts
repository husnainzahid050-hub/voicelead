import "server-only";
import { randomInt } from "node:crypto";
import type { BusinessProfileInput } from "@/lib/schemas/business";
import { slugCandidates, slugify } from "@/lib/slug";
import type { AuthUser } from "@/server/auth/types";
import { writeAudit } from "@/server/repositories/audit";
import {
  AlreadyOnboardedError,
  createBusinessWithOwner,
  findTakenSlugs,
} from "@/server/repositories/business";
import { isUniqueViolation } from "@/server/repositories/errors";

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const randomSuffix = (length = 4) =>
  Array.from({ length }, () => SLUG_ALPHABET.charAt(randomInt(SLUG_ALPHABET.length))).join("");

/** First free slug derived from the clinic name; random fallback for non-Latin names. */
export async function pickAvailableSlug(name: string, excludeBusinessId?: string): Promise<string> {
  const base = slugify(name) || `clinic-${randomSuffix()}`;
  const candidates = slugCandidates(base);
  const taken = await findTakenSlugs(candidates, excludeBusinessId);
  return candidates.find((s) => !taken.has(s)) ?? `${base.slice(0, 40)}-${randomSuffix()}`;
}

export type OnboardingResult =
  { ok: true; slug: string } | { ok: false; reason: "already_onboarded" };

export async function completeOnboarding(
  user: AuthUser,
  input: BusinessProfileInput,
  ipHash: string,
): Promise<OnboardingResult> {
  if (user.businessId) return { ok: false, reason: "already_onboarded" };

  // Retry once on a slug race (two clinics with the same name at the same moment).
  for (let attempt = 0; attempt < 2; attempt++) {
    const slug =
      attempt === 0
        ? await pickAvailableSlug(input.name)
        : `${slugify(input.name) || "clinic"}-${randomSuffix()}`;
    try {
      const business = await createBusinessWithOwner(user.id, slug, input);
      if (!business) break;
      await writeAudit({
        businessId: business.id,
        userId: user.id,
        action: "business.updated",
        ipHash,
        metadata: { event: "created" },
      });
      return { ok: true, slug: business.slug };
    } catch (error) {
      if (error instanceof AlreadyOnboardedError) return { ok: false, reason: "already_onboarded" };
      if (isUniqueViolation(error) && attempt === 0) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate an intake link");
}
