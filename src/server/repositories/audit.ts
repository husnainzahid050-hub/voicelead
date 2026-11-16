import "server-only";
import { db } from "@/lib/db";
import type { AuditAction } from "@/types/domain";

export interface AuditEntry {
  businessId: string;
  action: AuditAction;
  userId?: string | null;
  leadId?: string | null;
  ipHash?: string | null;
  /** Must never contain full phone numbers, secrets, or free-text customer data. */
  metadata?: Record<string, string | number | boolean | string[] | null>;
}

/**
 * Audit writes are best-effort: a logging failure must never block the
 * user's action, but it is reported server-side.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        businessId: entry.businessId,
        action: entry.action,
        userId: entry.userId ?? null,
        leadId: entry.leadId ?? null,
        ipHash: entry.ipHash ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  } catch {
    console.error(`[audit] failed to write ${entry.action}`);
  }
}
