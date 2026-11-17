import "server-only";
import { db } from "@/lib/db";
import { toAsciiDigits } from "@/lib/phone";
import { generateReferenceNumber } from "@/lib/reference";
import type { AuthContext } from "@/server/auth/types";
import type {
  FieldSource,
  LeadFieldName,
  LeadStatus,
  Language,
  TurnRole,
  Urgency,
} from "@/types/domain";
import { isUniqueViolation } from "./errors";

export interface NewLeadData {
  businessId: string;
  customerName: string | null;
  phone: string;
  serviceNeeded: string;
  urgency: Urgency;
  preferredDate: string | null;
  preferredDateText: string | null;
  preferredTime: string | null;
  summary: string;
  transcript: string;
  language: Language;
  aiConfidence: number | null;
  status: LeadStatus;
  deletionTokenHash: string;
  deletionExpiresAt: Date;
  fields: Array<{
    fieldName: LeadFieldName;
    value: string | null;
    confidence: number | null;
    source: FieldSource;
  }>;
  turns: Array<{ role: TurnRole; content: string }>;
  ipHash: string;
  auditMetadata: Record<string, string | number | boolean | string[] | null>;
}

/**
 * Creates the lead, its fields, the conversation and the audit entry in one
 * transaction. Retries on the (astronomically rare) reference-number collision.
 */
export async function createLead(
  data: NewLeadData,
): Promise<{ id: string; referenceNumber: string }> {
  const { fields, turns, ipHash, auditMetadata, ...lead } = data;
  for (let attempt = 0; attempt < 3; attempt++) {
    const referenceNumber = generateReferenceNumber();
    try {
      return await db.$transaction(async (tx) => {
        const created = await tx.lead.create({
          data: {
            ...lead,
            referenceNumber,
            fields: { create: fields },
            turns: { create: turns.map((t, i) => ({ ...t, createdAt: new Date(Date.now() + i) })) },
          },
          select: { id: true, referenceNumber: true },
        });
        await tx.auditLog.create({
          data: {
            businessId: lead.businessId,
            leadId: created.id,
            userId: null,
            action: "lead.created",
            ipHash,
            metadata: JSON.stringify({ ...auditMetadata, referenceNumber }),
          },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a reference number");
}

/** Abuse protection: how many leads a business received since `since`. */
export function countLeadsSince(businessId: string, since: Date) {
  return db.lead.count({ where: { businessId, createdAt: { gte: since } } });
}

/** For the customer's own deletion request: scoped to the clinic whose page made the call. */
export function findLeadForCustomerDeletion(businessId: string, referenceNumber: string) {
  return db.lead.findFirst({
    where: { businessId, referenceNumber, deletedAt: null },
    select: { id: true, deletionTokenHash: true, deletionExpiresAt: true },
  });
}

// ── Dashboard (authenticated) ─────────────────────────────────────────
// Every function below takes an AuthContext and scopes by ctx.businessId,
// so a lead id from the URL can never reach another clinic's data (IDOR).

const listSelect = {
  id: true,
  referenceNumber: true,
  customerName: true,
  phone: true,
  serviceNeeded: true,
  urgency: true,
  status: true,
  preferredDate: true,
  preferredTime: true,
  aiConfidence: true,
  summary: true,
  createdAt: true,
} as const;

export interface LeadListFilter {
  statuses?: string[];
  urgencies?: string[];
  search?: string | null;
}

function buildWhere(ctx: AuthContext, filter: LeadListFilter) {
  const q = filter.search?.trim();
  const digits = q
    ? toAsciiDigits(q)
        .replace(/\D/g, "")
        .replace(/^(0092|92|0)/, "")
    : "";
  return {
    businessId: ctx.businessId,
    deletedAt: null,
    ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
    ...(filter.urgencies ? { urgency: { in: filter.urgencies } } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" as const } },
            { serviceNeeded: { contains: q, mode: "insensitive" as const } },
            { referenceNumber: { contains: q.toUpperCase() } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };
}

/** Newest first, paginated in the database. */
export async function listLeadsNewest(
  ctx: AuthContext,
  filter: LeadListFilter,
  skip: number,
  take: number,
) {
  const where = buildWhere(ctx, filter);
  const [items, total] = await Promise.all([
    db.lead.findMany({ where, select: listSelect, orderBy: { createdAt: "desc" }, skip, take }),
    db.lead.count({ where }),
  ]);
  return { items, total };
}

/**
 * Candidates for urgency sorting (done in memory, since urgency is a string).
 * Capped: at MVP volumes a clinic has far fewer open leads than this.
 */
export function listLeadsForRanking(ctx: AuthContext, filter: LeadListFilter, cap = 1000) {
  return db.lead.findMany({
    where: buildWhere(ctx, filter),
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take: cap,
  });
}

/** Phones that appear on more than one recent lead (possible duplicates). */
export async function findRecentDuplicatePhones(
  ctx: AuthContext,
  sinceDays = 14,
): Promise<Set<string>> {
  const rows = await db.lead.groupBy({
    by: ["phone"],
    where: {
      businessId: ctx.businessId,
      deletedAt: null,
      phone: { not: null },
      createdAt: { gte: new Date(Date.now() - sinceDays * 86_400_000) },
    },
    _count: { _all: true },
    having: { phone: { _count: { gt: 1 } } },
  });
  return new Set(rows.flatMap((r) => (r.phone ? [r.phone] : [])));
}

export function findLeadForContext(ctx: AuthContext, id: string) {
  return db.lead.findFirst({
    where: { id, businessId: ctx.businessId, deletedAt: null },
    include: {
      fields: true,
      turns: { orderBy: { createdAt: "asc" } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } } },
      },
    },
  });
}

export function findOtherLeadsWithPhone(ctx: AuthContext, excludeId: string, phone: string) {
  return db.lead.findMany({
    where: {
      businessId: ctx.businessId,
      deletedAt: null,
      phone,
      id: { not: excludeId },
      createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
    },
    select: { id: true, referenceNumber: true, createdAt: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

/** Scoped update; returns false if the lead is not this clinic's (or deleted). */
export async function updateLeadScoped(
  ctx: AuthContext,
  id: string,
  data: Parameters<typeof db.lead.updateMany>[0]["data"],
): Promise<boolean> {
  const result = await db.lead.updateMany({
    where: { id, businessId: ctx.businessId, deletedAt: null },
    data,
  });
  return result.count === 1;
}

/** Field edits by staff: update the lead and record provenance, atomically. */
export async function updateLeadFieldsScoped(
  ctx: AuthContext,
  id: string,
  leadData: Parameters<typeof db.lead.updateMany>[0]["data"],
  changedFields: Array<{ fieldName: LeadFieldName; value: string | null }>,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const updated = await tx.lead.updateMany({
      where: { id, businessId: ctx.businessId, deletedAt: null },
      data: leadData,
    });
    if (updated.count !== 1) return false;
    for (const f of changedFields) {
      await tx.leadField.upsert({
        where: { leadId_fieldName: { leadId: id, fieldName: f.fieldName } },
        create: {
          leadId: id,
          fieldName: f.fieldName,
          value: f.value,
          source: "staff",
          editedByUser: true,
          confidence: 1,
        },
        update: { value: f.value, source: "staff", editedByUser: true, confidence: 1 },
      });
    }
    return true;
  });
}

/**
 * Privacy-preserving delete: personal data is erased and the conversation
 * removed; the row (reference number, timestamps) remains so the audit trail
 * still makes sense.
 */
export async function eraseLeadScoped(
  ctx: Pick<AuthContext, "businessId">,
  id: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const updated = await tx.lead.updateMany({
      where: { id, businessId: ctx.businessId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        customerName: null,
        phone: null,
        serviceNeeded: null,
        preferredDate: null,
        preferredDateText: null,
        preferredTime: null,
        summary: null,
        transcript: "[deleted]",
        internalNotes: null,
        followUpMessage: null,
        deletionTokenHash: null,
        deletionExpiresAt: null,
      },
    });
    if (updated.count !== 1) return false;
    await tx.leadField.deleteMany({ where: { leadId: id } });
    await tx.conversationTurn.deleteMany({ where: { leadId: id } });
    return true;
  });
}

/** Dashboard metric helpers. */
export function countLeads(ctx: AuthContext, where: Record<string, unknown>) {
  return db.lead.count({ where: { businessId: ctx.businessId, deletedAt: null, ...where } });
}

export function recentServices(ctx: AuthContext, since: Date) {
  return db.lead.groupBy({
    by: ["serviceNeeded"],
    where: { businessId: ctx.businessId, deletedAt: null, createdAt: { gte: since } },
    _count: { _all: true },
  });
}

export function lastViewedBy(ctx: AuthContext, leadId: string, since: Date) {
  return db.auditLog.findFirst({
    where: {
      businessId: ctx.businessId,
      leadId,
      userId: ctx.userId,
      action: "lead.viewed",
      createdAt: { gte: since },
    },
    select: { id: true },
  });
}
