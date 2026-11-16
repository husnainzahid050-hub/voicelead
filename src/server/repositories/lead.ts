import "server-only";
import { db } from "@/lib/db";
import { generateReferenceNumber } from "@/lib/reference";
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
