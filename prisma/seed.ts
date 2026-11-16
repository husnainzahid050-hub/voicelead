/**
 * Demo seed. Wipes and recreates all data — development only.
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_TIMEZONE, LEAD_FIELD_NAMES } from "../src/lib/constants";
import { normalizePkPhone } from "../src/lib/phone";
import { generateReferenceNumber } from "../src/lib/reference";
import { shortTextListSchema, workingHoursSchema } from "../src/lib/validation";
import type { LeadFieldName } from "../src/types/domain";
import { SEED_BUSINESSES, SEED_USERS } from "./seed-data/business";
import { SEED_LEADS, type SeedLead } from "./seed-data/leads";

const seedEnv = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.string().min(1),
    DEMO_OWNER_PASSWORD: z.string().min(12, "DEMO_OWNER_PASSWORD must be at least 12 characters"),
  })
  .parse(process.env);

if (seedEnv.NODE_ENV === "production") {
  throw new Error("Refusing to seed: NODE_ENV is production. The seed deletes all data.");
}

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: seedEnv.DATABASE_URL }) });

const MINUTE = 60_000;
const now = Date.now();
const at = (ms: number): Date => new Date(Math.min(ms, now));

function requirePhone(raw: string, context: string): string {
  const normalized = normalizePkPhone(raw);
  if (!normalized) throw new Error(`Invalid seed phone "${raw}" (${context})`);
  return normalized.e164;
}

/** YYYY-MM-DD of `base + offsetDays` in the clinic timezone. */
function dateInTimezone(base: Date, offsetDays: number): string {
  const shifted = new Date(base.getTime() + offsetDays * 24 * 60 * MINUTE);
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(shifted);
}

function uniqueReference(used: Set<string>): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const ref = generateReferenceNumber();
    if (!used.has(ref)) {
      used.add(ref);
      return ref;
    }
  }
  throw new Error("Could not generate a unique reference number");
}

function buildFields(lead: SeedLead, phone: string | null, preferredDate: string | null) {
  const values: Record<LeadFieldName, string | null> = {
    customer_name: lead.customerName,
    phone,
    service_needed: lead.serviceNeeded,
    preferred_date: preferredDate,
    preferred_time: lead.preferredTime,
    urgency: lead.urgency,
    notes: lead.notes,
  };

  return LEAD_FIELD_NAMES.map((fieldName) => {
    const source = lead.fieldSources?.[fieldName] ?? "ai";
    const value = values[fieldName];
    return {
      fieldName,
      value,
      // Human-provided values are certain; AI values carry the lead's confidence.
      confidence: value === null ? null : source === "ai" ? lead.aiConfidence : 1,
      source,
      editedByUser: source === "staff",
    };
  });
}

async function main(): Promise<void> {
  console.log("Clearing existing data…");
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.conversationTurn.deleteMany(),
    db.leadField.deleteMany(),
    db.lead.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
    db.business.deleteMany(),
    db.rateLimit.deleteMany(),
  ]);

  // ── Businesses ──────────────────────────────────────────────────────
  const businessIds = new Map<string, string>();
  for (const b of SEED_BUSINESSES) {
    const created = await db.business.create({
      data: {
        name: b.name,
        slug: b.slug,
        businessType: "dental",
        description: b.description,
        phone: requirePhone(b.phone, b.name),
        email: b.email,
        address: b.address,
        workingHours: JSON.stringify(workingHoursSchema.parse(b.workingHours)),
        services: JSON.stringify(shortTextListSchema.parse(b.services)),
        intakeInstructions: b.intakeInstructions,
        commonQuestions: JSON.stringify(shortTextListSchema.parse(b.commonQuestions)),
        followUpTone: b.followUpTone,
      },
    });
    businessIds.set(b.key, created.id);
  }

  // ── Users ───────────────────────────────────────────────────────────
  const passwordHash = await hash(seedEnv.DEMO_OWNER_PASSWORD);
  const userIds = new Map<string, string>(); // email → id
  const ownerByBusiness = new Map<string, string>();
  const staffByBusiness = new Map<string, string>();
  for (const u of SEED_USERS) {
    const businessId = businessIds.get(u.businessKey);
    if (!businessId) throw new Error(`Unknown business for ${u.email}`);
    const created = await db.user.create({
      data: { email: u.email.toLowerCase(), name: u.name, role: u.role, passwordHash, businessId },
    });
    userIds.set(u.email, created.id);
    (u.role === "owner" ? ownerByBusiness : staffByBusiness).set(u.businessKey, created.id);
  }

  // ── Leads ───────────────────────────────────────────────────────────
  const usedRefs = new Set<string>();
  for (const lead of SEED_LEADS) {
    const businessId = businessIds.get(lead.businessKey);
    if (!businessId) throw new Error(`Unknown business key ${lead.businessKey}`);
    const ownerId = ownerByBusiness.get(lead.businessKey) ?? null;
    const staffId = staffByBusiness.get(lead.businessKey) ?? ownerId;

    const createdAt = new Date(now - lead.minutesAgo * MINUTE);
    const phone = lead.phone ? requirePhone(lead.phone, lead.summary) : null;
    const preferredDate =
      lead.preferredDayOffset === null ? null : dateInTimezone(createdAt, lead.preferredDayOffset);

    // Conversation: the first customer message, then any clarifying Q&A,
    // spaced 20 seconds apart and ending when the lead was submitted.
    const allTurns = [{ role: "customer" as const, content: lead.transcript }, ...lead.turns];
    const turnStart = createdAt.getTime() - allTurns.length * 20_000;

    const created = await db.lead.create({
      data: {
        businessId,
        referenceNumber: uniqueReference(usedRefs),
        customerName: lead.customerName,
        phone,
        serviceNeeded: lead.serviceNeeded,
        urgency: lead.urgency,
        preferredDate,
        preferredDateText: lead.preferredDateText,
        preferredTime: lead.preferredTime,
        summary: lead.summary,
        transcript: lead.transcript,
        language: lead.language,
        aiConfidence: lead.aiConfidence,
        status: lead.status,
        internalNotes: lead.internalNotes ?? null,
        followUpMessage: lead.followUpMessage ?? null,
        createdAt,
        fields: { create: buildFields(lead, phone, preferredDate) },
        turns: {
          create: allTurns.map((turn, i) => ({
            role: turn.role,
            content: turn.content,
            createdAt: new Date(turnStart + i * 20_000),
          })),
        },
      },
    });

    // ── Audit trail consistent with the lead's current state ──────────
    const audit: Array<{
      action: string;
      userId: string | null;
      metadata: Record<string, unknown>;
      createdAt: Date;
    }> = [
      {
        action: "lead.created",
        userId: null,
        metadata: { source: "seed", referenceNumber: created.referenceNumber },
        createdAt,
      },
    ];
    if (lead.status !== "new") {
      audit.push({
        action: "lead.viewed",
        userId: ownerId,
        metadata: {},
        createdAt: at(createdAt.getTime() + 8 * MINUTE),
      });
    }
    const staffEdited = Object.entries(lead.fieldSources ?? {})
      .filter(([, source]) => source === "staff")
      .map(([field]) => field);
    if (staffEdited.length > 0) {
      audit.push({
        action: "lead.edited",
        userId: ownerId,
        metadata: { fields: staffEdited },
        createdAt: at(createdAt.getTime() + 10 * MINUTE),
      });
    }
    if (lead.status !== "new") {
      audit.push({
        action: "lead.status_changed",
        userId: lead.status === "contacted" ? staffId : ownerId,
        metadata: { from: "new", to: lead.status },
        createdAt: at(createdAt.getTime() + 12 * MINUTE),
      });
    }
    if (lead.followUpMessage && ["contacted", "booked", "lost"].includes(lead.status)) {
      audit.push({
        action: "followup.copied",
        userId: staffId,
        metadata: {},
        createdAt: at(createdAt.getTime() + 14 * MINUTE),
      });
    }

    await db.auditLog.createMany({
      data: audit.map((entry) => ({
        businessId,
        leadId: created.id,
        userId: entry.userId,
        action: entry.action,
        metadata: JSON.stringify(entry.metadata),
        createdAt: entry.createdAt,
      })),
    });
  }

  const [businesses, users, leads, fields, turns, logs] = await Promise.all([
    db.business.count(),
    db.user.count(),
    db.lead.count(),
    db.leadField.count(),
    db.conversationTurn.count(),
    db.auditLog.count(),
  ]);
  console.log(
    `Seeded ${businesses} businesses, ${users} users, ${leads} leads, ${fields} lead fields, ${turns} conversation turns, ${logs} audit entries.`,
  );
  console.log(`Demo logins: ${[...userIds.keys()].join(", ")} (password from DEMO_OWNER_PASSWORD)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
