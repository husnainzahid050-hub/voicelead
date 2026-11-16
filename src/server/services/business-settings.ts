import "server-only";
import {
  followUpToneSchema,
  parseJsonColumn,
  shortTextListSchema,
  workingHoursSchema,
  type WorkingHours,
} from "@/lib/validation";
import type { BusinessSettingsInput } from "@/lib/schemas/business";
import { isReservedSlug } from "@/lib/slug";
import { authorize } from "@/server/auth/authorize";
import type { AuthContext } from "@/server/auth/types";
import { writeAudit } from "@/server/repositories/audit";
import {
  countLeadsForContext,
  findBusinessForContext,
  findTakenSlugs,
  updateBusinessForContext,
} from "@/server/repositories/business";
import { isUniqueViolation } from "@/server/repositories/errors";
import type { FollowUpTone } from "@/types/domain";

/** Shaped settings sent to the client — never the raw database row. */
export interface BusinessSettingsDTO {
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  address: string | null;
  description: string | null;
  services: string[];
  workingHours: WorkingHours;
  intakeInstructions: string | null;
  commonQuestions: string[];
  followUpTone: FollowUpTone;
  isActive: boolean;
}

type BusinessRow = NonNullable<Awaited<ReturnType<typeof findBusinessForContext>>>;

function toSettingsDTO(b: BusinessRow): BusinessSettingsDTO {
  return {
    name: b.name,
    slug: b.slug,
    phone: b.phone,
    email: b.email,
    address: b.address,
    description: b.description,
    services: parseJsonColumn(b.services, shortTextListSchema, []),
    workingHours: parseJsonColumn(b.workingHours, workingHoursSchema, []),
    intakeInstructions: b.intakeInstructions,
    commonQuestions: parseJsonColumn(b.commonQuestions, shortTextListSchema, []),
    followUpTone: followUpToneSchema.catch("friendly").parse(b.followUpTone),
    isActive: b.isActive,
  };
}

async function loadBusiness(ctx: AuthContext): Promise<BusinessRow> {
  const business = await findBusinessForContext(ctx);
  // The session pointed at a business that no longer exists: treat as not found.
  if (!business) throw new Error("Business not found for session");
  return business;
}

export async function getBusinessSettings(ctx: AuthContext): Promise<BusinessSettingsDTO> {
  authorize(ctx, "settings:read");
  return toSettingsDTO(await loadBusiness(ctx));
}

export type UpdateSettingsResult =
  { ok: true; changed: string[] } | { ok: false; fieldErrors: Record<string, string> };

export async function updateBusinessSettings(
  ctx: AuthContext,
  input: BusinessSettingsInput,
  ipHash: string,
): Promise<UpdateSettingsResult> {
  authorize(ctx, "settings:update");
  const before = toSettingsDTO(await loadBusiness(ctx));

  if (input.slug !== before.slug) {
    if (isReservedSlug(input.slug)) {
      return { ok: false, fieldErrors: { slug: "This link name is reserved. Try another." } };
    }
    const taken = await findTakenSlugs([input.slug], ctx.businessId);
    if (taken.has(input.slug)) {
      return { ok: false, fieldErrors: { slug: "Another clinic already uses this link." } };
    }
  }

  try {
    await updateBusinessForContext(ctx, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, fieldErrors: { slug: "Another clinic already uses this link." } };
    }
    throw error;
  }

  // Record which fields changed, never their values.
  const changed = (Object.keys(input) as Array<keyof BusinessSettingsInput>).filter(
    (key) => JSON.stringify(input[key]) !== JSON.stringify(before[key]),
  );
  if (changed.length > 0) {
    await writeAudit({
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: "business.updated",
      ipHash,
      metadata: { fields: changed },
    });
  }
  return { ok: true, changed };
}

export interface IntakeLinkDTO {
  businessName: string;
  slug: string;
  isActive: boolean;
}

export async function getIntakeLinkInfo(ctx: AuthContext): Promise<IntakeLinkDTO> {
  authorize(ctx, "intake-link:read");
  const b = await loadBusiness(ctx);
  return { businessName: b.name, slug: b.slug, isActive: b.isActive };
}

export async function getDashboardSummary(ctx: AuthContext) {
  authorize(ctx, "leads:read");
  const [business, leadCount] = await Promise.all([loadBusiness(ctx), countLeadsForContext(ctx)]);
  return {
    businessName: business.name,
    slug: business.slug,
    isActive: business.isActive,
    leadCount,
  };
}
