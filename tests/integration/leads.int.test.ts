/**
 * Dashboard lead operations against the test DB: tenant isolation (IDOR),
 * roles, provenance, audit and privacy-preserving deletion.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { leadFieldsUpdateSchema, leadListQuerySchema } from "@/lib/schemas/lead";
import { ForbiddenError, type AuthContext } from "@/server/auth/types";
import {
  LeadNotFoundError,
  LeadRuleError,
  changeLeadStatus,
  deleteLead,
  generateFollowUp,
  getDashboardMetrics,
  getLeadDetail,
  listLeads,
  recordLeadViewed,
  saveInternalNotes,
  updateLeadFields,
} from "@/server/services/leads";

let owner: AuthContext;
let staff: AuthContext;
let otherOwner: AuthContext;
let smileLeadId: string;

async function ctxFor(email: string): Promise<AuthContext> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  return { userId: u.id, businessId: u.businessId!, role: u.role as AuthContext["role"] };
}

const query = (q: Partial<Record<string, string>> = {}) => leadListQuerySchema.parse(q);

beforeAll(async () => {
  owner = await ctxFor("owner@smilecare.demo");
  staff = await ctxFor("staff@smilecare.demo");
  otherOwner = await ctxFor("owner@brightsmile.demo");
  const lead = await db.lead.findFirstOrThrow({
    where: { businessId: owner.businessId, customerName: "Zainab Hussain" },
  });
  smileLeadId = lead.id;
});

describe("lead list", () => {
  it("only ever returns the caller's own clinic's leads", async () => {
    const mine = await listLeads(otherOwner, query());
    const ids = new Set(mine.items.map((l) => l.id));
    const foreign = await db.lead.count({
      where: { id: { in: [...ids] }, businessId: { not: otherOwner.businessId } },
    });
    expect(foreign).toBe(0);
    expect(ids.has(smileLeadId)).toBe(false);
  });

  it("masks phone numbers in the list", async () => {
    const { items } = await listLeads(owner, query());
    expect(
      items.every((l) => l.phoneMasked === "—" || /^\+92 \d{3} \*\*\*\d{4}$/.test(l.phoneMasked)),
    ).toBe(true);
    expect(JSON.stringify(items)).not.toMatch(/\+923\d{9}/);
  });

  it("sorts open emergencies first and filters high priority", async () => {
    const { items } = await listLeads(owner, query());
    expect(items[0]?.urgency).toBe("emergency");
    const priority = await listLeads(owner, query({ filter: "priority" }));
    expect(priority.items.length).toBeGreaterThan(0);
    expect(priority.items.every((l) => ["high", "emergency"].includes(l.urgency))).toBe(true);
    expect(
      priority.items.every((l) => ["new", "needs_review", "ready_to_contact"].includes(l.status)),
    ).toBe(true);
  });

  it("finds leads by phone in any format, by name and by reference", async () => {
    const byPhone = await listLeads(owner, query({ q: "0300-0000101" }));
    expect(byPhone.items.map((l) => l.customerName).sort()).toEqual(["Ali", "Ali Raza"]);
    expect(byPhone.items.every((l) => l.possibleDuplicate)).toBe(true);
    const byName = await listLeads(owner, query({ q: "Zainab" }));
    expect(byName.items).toHaveLength(1);
    const ref = byName.items[0]!.referenceNumber;
    expect((await listLeads(owner, query({ q: ref.toLowerCase() }))).items[0]?.id).toBe(
      smileLeadId,
    );
  });
});

describe("IDOR: another clinic's lead id behaves as 'not found'", () => {
  it("cannot read it", async () => {
    expect(await getLeadDetail(otherOwner, smileLeadId)).toBeNull();
  });

  it("cannot edit, change status, add notes, draft messages or delete it", async () => {
    const before = await db.lead.findUniqueOrThrow({ where: { id: smileLeadId } });
    const input = leadFieldsUpdateSchema.parse({
      customerName: "Hijacked",
      phone: "0300 1111111",
      serviceNeeded: "Filling",
      urgency: "low",
      preferredDate: "",
      preferredTime: "",
      notes: "",
      summary: "",
    });
    await expect(updateLeadFields(otherOwner, smileLeadId, input, "ip")).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
    await expect(changeLeadStatus(otherOwner, smileLeadId, "lost", "ip")).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
    await expect(saveInternalNotes(otherOwner, smileLeadId, "x", "ip")).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
    await expect(generateFollowUp(otherOwner, smileLeadId, "ip")).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
    await expect(deleteLead(otherOwner, smileLeadId, "ip")).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
    const after = await db.lead.findUniqueOrThrow({ where: { id: smileLeadId } });
    expect(after).toEqual(before);
  });
});

describe("editing and workflow", () => {
  it("records staff edits with provenance and audits field names only", async () => {
    const lead = (await getLeadDetail(staff, smileLeadId))!;
    const result = await updateLeadFields(
      staff,
      smileLeadId,
      leadFieldsUpdateSchema.parse({
        customerName: "Zainab H.",
        phone: lead.phoneDisplay,
        serviceNeeded: lead.serviceNeeded,
        urgency: lead.urgency,
        preferredDate: lead.preferredDate ?? "",
        preferredTime: "18:30",
        notes: lead.notes ?? "",
        summary: lead.summary ?? "",
      }),
      "ip",
    );
    expect(result.changed.sort()).toEqual(["customer_name", "preferred_time"]);
    const fields = await db.leadField.findMany({
      where: { leadId: smileLeadId, fieldName: { in: ["customer_name", "preferred_time"] } },
    });
    expect(fields.every((f) => f.source === "staff" && f.editedByUser)).toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { leadId: smileLeadId, action: "lead.edited" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.userId).toBe(staff.userId);
    expect(audit.metadata).not.toContain("Zainab");
  });

  it("enforces status rules on the server and audits transitions", async () => {
    await expect(changeLeadStatus(owner, smileLeadId, "contacted", "ip")).rejects.toBeInstanceOf(
      LeadRuleError,
    ); // already contacted
    await changeLeadStatus(staff, smileLeadId, "booked", "ip");
    const audit = await db.auditLog.findFirstOrThrow({
      where: { leadId: smileLeadId, action: "lead.status_changed" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.parse(audit.metadata!)).toEqual({ from: "contacted", to: "booked" });
  });

  it("drafts a follow-up from the template when AI is not Gemini, without false promises", async () => {
    const target = await db.lead.findFirstOrThrow({
      where: { businessId: owner.businessId, status: "ready_to_contact", deletedAt: null },
    });
    const { message, source } = await generateFollowUp(staff, target.id, "ip");
    expect(source).toBe("template");
    expect(message.length).toBeLessThanOrEqual(500);
    expect(message).not.toMatch(/confirmed|book ho gayi|بک ہو گئی/i);
    expect((await db.lead.findUniqueOrThrow({ where: { id: target.id } })).followUpMessage).toBe(
      message,
    );
  });

  it("logs a view at most once per 30 minutes per user", async () => {
    const count = () =>
      db.auditLog.count({
        where: { leadId: smileLeadId, userId: owner.userId, action: "lead.viewed" },
      });
    const before = await count();
    await recordLeadViewed(owner, smileLeadId);
    await recordLeadViewed(owner, smileLeadId);
    expect(await count()).toBe(before + 1);
  });
});

describe("deletion", () => {
  it("staff cannot delete", async () => {
    await expect(deleteLead(staff, smileLeadId, "ip")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("owner delete erases personal data but keeps an auditable stub", async () => {
    const ref = (await db.lead.findUniqueOrThrow({ where: { id: smileLeadId } })).referenceNumber;
    await deleteLead(owner, smileLeadId, "ip");
    const row = await db.lead.findUniqueOrThrow({ where: { id: smileLeadId } });
    expect(row.deletedAt).not.toBeNull();
    expect([
      row.customerName,
      row.phone,
      row.summary,
      row.internalNotes,
      row.followUpMessage,
    ]).toEqual([null, null, null, null, null]);
    expect(row.transcript).toBe("[deleted]");
    expect(await db.leadField.count({ where: { leadId: smileLeadId } })).toBe(0);
    expect(await db.conversationTurn.count({ where: { leadId: smileLeadId } })).toBe(0);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { leadId: smileLeadId, action: "lead.deleted" },
    });
    expect(JSON.parse(audit.metadata!).referenceNumber).toBe(ref);
    expect(await getLeadDetail(owner, smileLeadId)).toBeNull();
    expect((await listLeads(owner, query({ q: ref }))).total).toBe(0);
  });
});

describe("dashboard metrics", () => {
  it("are scoped and internally consistent", async () => {
    const m = await getDashboardMetrics(owner);
    expect(m.highPriority).toBeLessThanOrEqual(m.awaitingCallback);
    expect(
      m.needsAction.every((l) => ["new", "needs_review", "ready_to_contact"].includes(l.status)),
    ).toBe(true);
    const other = await getDashboardMetrics(otherOwner);
    expect(other.awaitingCallback).toBeLessThan(m.awaitingCallback);
  });
});
