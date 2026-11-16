import "server-only";
import { LEAD_STATUSES, URGENCIES, URGENCY_RANK, LANGUAGES, FIELD_SOURCES } from "@/lib/constants";
import { isoDateInTimezone } from "@/lib/dates";
import { buildFollowUpTemplate, followUpProblem, type FollowUpInput } from "@/lib/leads/follow-up";
import { OPEN_STATUSES, isOpen, transitionError } from "@/lib/leads/workflow";
import { formatPkPhone, maskPhone, toWhatsAppDigits } from "@/lib/phone";
import type { LeadFieldsUpdate, LeadListQuery } from "@/lib/schemas/lead";
import { followUpToneSchema, parseJsonColumn, shortTextListSchema } from "@/lib/validation";
import { z } from "zod";
import { authorize } from "@/server/auth/authorize";
import type { AuthContext } from "@/server/auth/types";
import { getLeadAI } from "@/server/ai/provider";
import { writeAudit } from "@/server/repositories/audit";
import { findBusinessForContext } from "@/server/repositories/business";
import {
  countLeads,
  eraseLeadScoped,
  findLeadForContext,
  findOtherLeadsWithPhone,
  findRecentDuplicatePhones,
  lastViewedBy,
  listLeadsForRanking,
  listLeadsNewest,
  recentServices,
  updateLeadFieldsScoped,
  updateLeadScoped,
  type LeadListFilter,
} from "@/server/repositories/lead";
import type { FieldSource, Language, LeadFieldName, LeadStatus, Urgency } from "@/types/domain";

export class LeadNotFoundError extends Error {
  constructor() {
    super("Lead not found");
    this.name = "LeadNotFoundError";
  }
}

export class LeadRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadRuleError";
  }
}

// Values read from the DB are re-validated: a corrupt row degrades gracefully.
const asStatus = (v: string): LeadStatus => z.enum(LEAD_STATUSES).catch("needs_review").parse(v);
const asUrgency = (v: string): Urgency => z.enum(URGENCIES).catch("normal").parse(v);
const asLanguage = (v: string): Language => z.enum(LANGUAGES).catch("en").parse(v);
const asSource = (v: string): FieldSource => z.enum(FIELD_SOURCES).catch("ai").parse(v);

// ── List ──────────────────────────────────────────────────────────────

export interface LeadListItemDTO {
  id: string;
  referenceNumber: string;
  customerName: string | null;
  phoneMasked: string;
  serviceNeeded: string | null;
  urgency: Urgency;
  status: LeadStatus;
  preferredDate: string | null;
  preferredTime: string | null;
  aiConfidence: number | null;
  createdAt: string;
  possibleDuplicate: boolean;
}

const PAGE_SIZE = 20;

function filterFor(query: LeadListQuery): LeadListFilter {
  const base: LeadListFilter = { search: query.q };
  switch (query.filter) {
    case "all":
      return base;
    case "priority":
      return { ...base, urgencies: ["high", "emergency"], statuses: [...OPEN_STATUSES] };
    default:
      return { ...base, statuses: [query.filter] };
  }
}

export async function listLeads(ctx: AuthContext, query: LeadListQuery) {
  authorize(ctx, "leads:read");
  const filter = filterFor(query);
  const skip = (query.page - 1) * PAGE_SIZE;

  let rows: Awaited<ReturnType<typeof listLeadsForRanking>>;
  let total: number;
  if (query.sort === "newest") {
    ({ items: rows, total } = await listLeadsNewest(ctx, filter, skip, PAGE_SIZE));
  } else {
    // Open before closed, then most urgent, then newest.
    const all = await listLeadsForRanking(ctx, filter);
    all.sort((a, b) => {
      const open = Number(isOpen(asStatus(b.status))) - Number(isOpen(asStatus(a.status)));
      if (open !== 0) return open;
      const rank = URGENCY_RANK[asUrgency(b.urgency)] - URGENCY_RANK[asUrgency(a.urgency)];
      if (rank !== 0) return rank;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    total = all.length;
    rows = all.slice(skip, skip + PAGE_SIZE);
  }

  const duplicates = await findRecentDuplicatePhones(ctx);
  const items: LeadListItemDTO[] = rows.map((r) => ({
    id: r.id,
    referenceNumber: r.referenceNumber,
    customerName: r.customerName,
    phoneMasked: maskPhone(r.phone), // full number only on the detail page
    serviceNeeded: r.serviceNeeded,
    urgency: asUrgency(r.urgency),
    status: asStatus(r.status),
    preferredDate: r.preferredDate,
    preferredTime: r.preferredTime,
    aiConfidence: r.aiConfidence,
    createdAt: r.createdAt.toISOString(),
    possibleDuplicate: !!r.phone && duplicates.has(r.phone),
  }));
  return { items, total, page: query.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ── Detail ────────────────────────────────────────────────────────────

export interface LeadFieldDTO {
  value: string | null;
  confidence: number | null;
  source: FieldSource;
  editedByUser: boolean;
}

export interface LeadDetailDTO {
  id: string;
  referenceNumber: string;
  customerName: string | null;
  phone: string | null;
  phoneDisplay: string | null;
  whatsappDigits: string | null;
  serviceNeeded: string | null;
  urgency: Urgency;
  status: LeadStatus;
  preferredDate: string | null;
  preferredDateText: string | null;
  preferredTime: string | null;
  summary: string | null;
  transcript: string;
  language: Language;
  aiConfidence: number | null;
  internalNotes: string | null;
  followUpMessage: string | null;
  notes: string | null;
  createdAt: string;
  fields: Partial<Record<LeadFieldName, LeadFieldDTO>>;
  turns: Array<{ role: "customer" | "assistant"; content: string; createdAt: string }>;
  history: Array<{ action: string; who: string; at: string; detail: string | null }>;
  aiChecks: string[];
  duplicates: Array<{ id: string; referenceNumber: string; createdAt: string }>;
}

const metadataSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    fields: z.array(z.string()).optional(),
    flags: z.array(z.string()).optional(),
    source: z.string().optional(),
    mode: z.string().optional(),
    channel: z.string().optional(),
  })
  .passthrough();

function safeJson(raw: string | null | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

function describeAudit(action: string, metadata: z.infer<typeof metadataSchema>): string | null {
  switch (action) {
    case "lead.status_changed":
      return metadata.from && metadata.to ? `${metadata.from} → ${metadata.to}` : null;
    case "lead.edited":
      return metadata.fields?.length ? `Changed: ${metadata.fields.join(", ")}` : null;
    case "lead.created":
      return metadata.mode === "manual"
        ? "Submitted with the short form"
        : metadata.source === "seed"
          ? "Demo data"
          : "Submitted by voice/text intake";
    case "followup.generated":
      return metadata.source === "template" ? "From template" : "Written by AI";
    case "followup.copied":
      return metadata.channel === "whatsapp" ? "Opened in WhatsApp" : "Copied to clipboard";
    default:
      return null;
  }
}

export async function getLeadDetail(ctx: AuthContext, id: string): Promise<LeadDetailDTO | null> {
  authorize(ctx, "leads:read");
  const lead = await findLeadForContext(ctx, id);
  if (!lead) return null;

  const duplicates = lead.phone ? await findOtherLeadsWithPhone(ctx, lead.id, lead.phone) : [];
  const fields: LeadDetailDTO["fields"] = {};
  for (const f of lead.fields) {
    fields[f.fieldName as LeadFieldName] = {
      value: f.value,
      confidence: f.confidence,
      source: asSource(f.source),
      editedByUser: f.editedByUser,
    };
  }
  const created = lead.auditLogs.find((a) => a.action === "lead.created");
  const createdMeta = metadataSchema.safeParse(safeJson(created?.metadata));

  return {
    id: lead.id,
    referenceNumber: lead.referenceNumber,
    customerName: lead.customerName,
    phone: lead.phone,
    phoneDisplay: lead.phone ? formatPkPhone(lead.phone) : null,
    whatsappDigits: lead.phone ? toWhatsAppDigits(lead.phone) : null,
    serviceNeeded: lead.serviceNeeded,
    urgency: asUrgency(lead.urgency),
    status: asStatus(lead.status),
    preferredDate: lead.preferredDate,
    preferredDateText: lead.preferredDateText,
    preferredTime: lead.preferredTime,
    summary: lead.summary,
    transcript: lead.transcript,
    language: asLanguage(lead.language),
    aiConfidence: lead.aiConfidence,
    internalNotes: lead.internalNotes,
    followUpMessage: lead.followUpMessage,
    notes: fields.notes?.value ?? null,
    createdAt: lead.createdAt.toISOString(),
    fields,
    turns: lead.turns.map((t) => ({
      role: t.role === "assistant" ? "assistant" : "customer",
      content: t.content,
      createdAt: t.createdAt.toISOString(),
    })),
    history: lead.auditLogs.map((a) => {
      const parsed = metadataSchema.safeParse(safeJson(a.metadata));
      const meta = parsed.success ? parsed.data : {};
      return {
        action: a.action,
        who: a.user?.name ?? (a.action === "lead.created" ? "Patient" : "System"),
        at: a.createdAt.toISOString(),
        detail: describeAudit(a.action, meta),
      };
    }),
    aiChecks: createdMeta.success ? (createdMeta.data.flags ?? []) : [],
    duplicates: duplicates.map((d) => ({
      id: d.id,
      referenceNumber: d.referenceNumber,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

/** Log a view at most once per user per lead every 30 minutes. */
export async function recordLeadViewed(ctx: AuthContext, leadId: string): Promise<void> {
  const recent = await lastViewedBy(ctx, leadId, new Date(Date.now() - 30 * 60_000));
  if (recent) return;
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId,
    action: "lead.viewed",
  });
}

// ── Mutations ─────────────────────────────────────────────────────────

export async function updateLeadFields(
  ctx: AuthContext,
  id: string,
  input: LeadFieldsUpdate,
  ipHash: string,
) {
  authorize(ctx, "leads:update");
  const lead = await findLeadForContext(ctx, id);
  if (!lead) throw new LeadNotFoundError();

  const currentNotes = lead.fields.find((f) => f.fieldName === "notes")?.value ?? null;
  const comparisons: Array<[LeadFieldName | "summary", string | null, string | null]> = [
    ["customer_name", lead.customerName, input.customerName],
    ["phone", lead.phone, input.phone],
    ["service_needed", lead.serviceNeeded, input.serviceNeeded],
    ["urgency", lead.urgency, input.urgency],
    ["preferred_date", lead.preferredDate, input.preferredDate],
    ["preferred_time", lead.preferredTime, input.preferredTime],
    ["notes", currentNotes, input.notes],
    ["summary", lead.summary, input.summary],
  ];
  const changed = comparisons.filter(([, before, after]) => (before ?? "") !== (after ?? ""));
  if (changed.length === 0) return { changed: [] as string[] };

  const ok = await updateLeadFieldsScoped(
    ctx,
    id,
    {
      customerName: input.customerName,
      phone: input.phone,
      serviceNeeded: input.serviceNeeded,
      urgency: input.urgency,
      preferredDate: input.preferredDate,
      // The customer's original wording no longer describes a date staff changed.
      ...(lead.preferredDate !== input.preferredDate ? { preferredDateText: null } : {}),
      preferredTime: input.preferredTime,
      summary: input.summary,
    },
    changed
      .filter(([name]) => name !== "summary")
      .map(([name, , after]) => ({ fieldName: name as LeadFieldName, value: after })),
  );
  if (!ok) throw new LeadNotFoundError();

  const names = changed.map(([name]) => name);
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId: id,
    action: "lead.edited",
    ipHash,
    metadata: { fields: names },
  });
  return { changed: names };
}

export async function changeLeadStatus(
  ctx: AuthContext,
  id: string,
  to: LeadStatus,
  ipHash: string,
) {
  authorize(ctx, "leads:update");
  const lead = await findLeadForContext(ctx, id);
  if (!lead) throw new LeadNotFoundError();
  const from = asStatus(lead.status);
  const error = transitionError({
    from,
    to,
    hasPhone: !!lead.phone,
    hasService: !!lead.serviceNeeded,
  });
  if (error) throw new LeadRuleError(error);

  if (!(await updateLeadScoped(ctx, id, { status: to }))) throw new LeadNotFoundError();
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId: id,
    action: "lead.status_changed",
    ipHash,
    metadata: { from, to },
  });
}

export async function saveInternalNotes(
  ctx: AuthContext,
  id: string,
  notes: string | null,
  ipHash: string,
) {
  authorize(ctx, "leads:update");
  if (!(await updateLeadScoped(ctx, id, { internalNotes: notes }))) throw new LeadNotFoundError();
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId: id,
    action: "lead.edited",
    ipHash,
    metadata: { fields: ["internal_notes"] },
  });
}

/**
 * Draft a follow-up with the AI; fall back to the template when the AI is
 * unavailable or its text breaks a rule (too long, claims a confirmed booking).
 */
export async function generateFollowUp(ctx: AuthContext, id: string, ipHash: string) {
  authorize(ctx, "leads:update");
  const [lead, business] = await Promise.all([
    findLeadForContext(ctx, id),
    findBusinessForContext(ctx),
  ]);
  if (!lead || !business) throw new LeadNotFoundError();

  const input: FollowUpInput = {
    clinicName: business.name,
    clinicPhone: formatPkPhone(business.phone),
    customerName: lead.customerName,
    service: lead.serviceNeeded,
    preferredDate: lead.preferredDate,
    preferredTime: lead.preferredTime,
    status: asStatus(lead.status),
    language: asLanguage(lead.language),
    tone: followUpToneSchema.catch("friendly").parse(business.followUpTone),
  };

  let message = buildFollowUpTemplate(input);
  let source: "ai" | "template" = "template";
  const ai = await getLeadAI();
  if (ai && ai.name === "gemini") {
    try {
      const draft = (await ai.followUpMessage(input)).trim();
      if (!followUpProblem(draft, input.status)) {
        message = draft;
        source = "ai";
      }
    } catch {
      // Template already in place.
    }
  }

  if (!(await updateLeadScoped(ctx, id, { followUpMessage: message })))
    throw new LeadNotFoundError();
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId: id,
    action: "followup.generated",
    ipHash,
    metadata: { source },
  });
  return { message, source };
}

/** Staff edits to the message are allowed (they are in control); length is still enforced. */
export async function saveFollowUp(ctx: AuthContext, id: string, message: string) {
  authorize(ctx, "leads:update");
  if (!(await updateLeadScoped(ctx, id, { followUpMessage: message })))
    throw new LeadNotFoundError();
}

export async function recordFollowUpCopied(
  ctx: AuthContext,
  id: string,
  channel: "copy" | "whatsapp",
  ipHash: string,
) {
  authorize(ctx, "leads:read");
  const lead = await findLeadForContext(ctx, id);
  if (!lead) throw new LeadNotFoundError();
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId: id,
    action: "followup.copied",
    ipHash,
    metadata: { channel },
  });
}

export async function deleteLead(ctx: AuthContext, id: string, ipHash: string) {
  authorize(ctx, "leads:delete");
  const lead = await findLeadForContext(ctx, id);
  if (!lead) throw new LeadNotFoundError();
  if (!(await eraseLeadScoped(ctx, id))) throw new LeadNotFoundError();
  await writeAudit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    leadId: id,
    action: "lead.deleted",
    ipHash,
    metadata: { referenceNumber: lead.referenceNumber, by: "staff" },
  });
}

// ── Dashboard metrics ─────────────────────────────────────────────────

/** Options the lead form needs (available to staff, unlike full settings). */
export async function getLeadFormOptions(ctx: AuthContext) {
  authorize(ctx, "leads:read");
  const business = await findBusinessForContext(ctx);
  return {
    services: parseJsonColumn(business?.services, shortTextListSchema, []),
    clinicName: business?.name ?? "",
  };
}

export async function getDashboardMetrics(ctx: AuthContext) {
  authorize(ctx, "leads:read");
  const todayIso = isoDateInTimezone(new Date());
  const startOfToday = new Date(`${todayIso}T00:00:00+05:00`); // Asia/Karachi has no DST
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const open = { in: [...OPEN_STATUSES] };

  const [newToday, highPriority, awaitingCallback, booked, services, actionRows] =
    await Promise.all([
      countLeads(ctx, { createdAt: { gte: startOfToday } }),
      countLeads(ctx, { status: open, urgency: { in: ["high", "emergency"] } }),
      countLeads(ctx, { status: open }),
      countLeads(ctx, { status: "booked", updatedAt: { gte: thirtyDaysAgo } }),
      recentServices(ctx, thirtyDaysAgo),
      listLeads(ctx, { filter: "all", q: null, sort: "urgent", page: 1 }),
    ]);

  return {
    newToday,
    highPriority,
    awaitingCallback,
    bookedLast30Days: booked,
    topServices: services
      .map((s) => ({ service: s.serviceNeeded ?? "Not specified", count: s._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    needsAction: actionRows.items.filter((l) => isOpen(l.status)).slice(0, 5),
  };
}
