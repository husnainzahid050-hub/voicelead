import "server-only";
import { db } from "@/lib/db";
import type { AuthContext } from "@/server/auth/types";
import type { WorkingHours } from "@/lib/validation";

/**
 * Business data access. Every read/write of an existing business is scoped
 * by `ctx.businessId` from the server-side session — a business id supplied
 * by the client is never accepted here.
 */

export interface BusinessWriteData {
  name: string;
  phone: string;
  address: string | null;
  services: string[];
  workingHours: WorkingHours;
  intakeInstructions: string | null;
  commonQuestions: string[];
  followUpTone: string;
}

type JsonColumns = "services" | "workingHours" | "commonQuestions";

function serialize<T extends BusinessWriteData>(
  data: T,
): Omit<T, JsonColumns> & Record<JsonColumns, string> {
  return {
    ...data,
    services: JSON.stringify(data.services),
    workingHours: JSON.stringify(data.workingHours),
    commonQuestions: JSON.stringify(data.commonQuestions),
  };
}

export function findBusinessForContext(ctx: AuthContext) {
  return db.business.findUnique({ where: { id: ctx.businessId } });
}

/** Which of these slugs are already used by some *other* business. */
export async function findTakenSlugs(
  slugs: string[],
  excludeBusinessId?: string,
): Promise<Set<string>> {
  const rows = await db.business.findMany({
    where: {
      slug: { in: slugs },
      ...(excludeBusinessId ? { id: { not: excludeBusinessId } } : {}),
    },
    select: { slug: true },
  });
  return new Set(rows.map((r) => r.slug));
}

/**
 * Create a clinic and make `userId` its owner, atomically. The user update is
 * conditional on the user having no clinic yet, so a double submit or a
 * replayed request cannot attach a second clinic.
 */
export async function createBusinessWithOwner(
  userId: string,
  slug: string,
  data: BusinessWriteData,
): Promise<{ id: string; slug: string } | null> {
  return db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: { ...serialize(data), slug, businessType: "dental" },
      select: { id: true, slug: true },
    });
    const claimed = await tx.user.updateMany({
      where: { id: userId, businessId: null },
      data: { businessId: business.id, role: "owner" },
    });
    if (claimed.count !== 1) {
      throw new AlreadyOnboardedError();
    }
    return business;
  });
}

export class AlreadyOnboardedError extends Error {
  constructor() {
    super("User already belongs to a business");
    this.name = "AlreadyOnboardedError";
  }
}

export function updateBusinessForContext(
  ctx: AuthContext,
  data: BusinessWriteData & {
    slug: string;
    description: string | null;
    email: string | null;
    isActive: boolean;
  },
) {
  return db.business.update({
    where: { id: ctx.businessId },
    data: serialize(data),
  });
}

export function countLeadsForContext(ctx: AuthContext) {
  return db.lead.count({ where: { businessId: ctx.businessId, deletedAt: null } });
}
