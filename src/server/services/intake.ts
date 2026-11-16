import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { INTAKE_TOKEN_TTL_SECONDS, LANGUAGES, LIMITS, URGENCIES } from "@/lib/constants";
import { addDaysIso, isIsoDateWithin, isoDateInTimezone, weekdayInTimezone } from "@/lib/dates";
import { detectLanguage } from "@/lib/intake/language";
import { isSkippable, missingFields, templateQuestion } from "@/lib/intake/questions";
import {
  ASKABLE_FIELDS,
  SKIPPED_ANSWER,
  type AnalyzeResponse,
  type AskableField,
  type ClarifyingQuestion,
  type ConversationTurnInput,
  type ExtractedLead,
  type SubmitResponse,
} from "@/lib/intake/types";
import type { AnalyzeBody, SubmitBody } from "@/lib/schemas/intake";
import {
  parseJsonColumn,
  shortTextListSchema,
  workingHoursSchema,
  type WorkingHours,
} from "@/lib/validation";
import { hasRedFlag, sanitizeExtraction } from "@/server/ai/guards";
import { AiUnavailableError, getLeadAI, type LeadAI } from "@/server/ai/provider";
import { findBusinessForIntake, findPublicBusinessBySlug } from "@/server/repositories/business";
import { createLead } from "@/server/repositories/lead";
import { signToken, verifyToken } from "@/server/signing";
import type { FieldSource, LeadFieldName, LeadStatus } from "@/types/domain";

// ── Public business view ──────────────────────────────────────────────

export interface PublicBusinessDTO {
  name: string;
  slug: string;
  description: string | null;
  phone: string;
  address: string | null;
  services: string[];
  workingHours: WorkingHours;
  intakeInstructions: string | null;
  isActive: boolean;
}

export async function getPublicBusiness(
  slug: string,
): Promise<{ business: PublicBusinessDTO; intakeToken: string | null } | null> {
  const b = await findPublicBusinessBySlug(slug);
  if (!b) return null;
  return {
    business: {
      name: b.name,
      slug: b.slug,
      description: b.description,
      phone: b.phone,
      address: b.address,
      services: parseJsonColumn(b.services, shortTextListSchema, []),
      workingHours: parseJsonColumn(b.workingHours, workingHoursSchema, []),
      intakeInstructions: b.intakeInstructions,
      isActive: b.isActive,
    },
    // Only an active clinic's page can make intake requests.
    intakeToken: b.isActive
      ? signToken("intake", { b: b.id, s: b.slug }, INTAKE_TOKEN_TTL_SECONDS)
      : null,
  };
}

// ── Request context (resolved from the signed intake token) ───────────

export const intakeTokenSchema = z.object({ b: z.string().min(1), s: z.string().min(1) });

export interface IntakeBusiness {
  id: string;
  name: string;
  slug: string;
  phone: string;
  services: string[];
}

export type ResolveResult =
  | { ok: true; business: IntakeBusiness }
  | { ok: false; code: "session_expired" | "forbidden" | "not_found" | "inactive" };

/** Verify the page token and load the clinic it was issued for. */
export async function resolveIntakeBusiness(
  token: string | null,
  slug: string,
): Promise<ResolveResult> {
  const verified = verifyToken("intake", token, intakeTokenSchema);
  if (!verified.ok)
    return { ok: false, code: verified.reason === "expired" ? "session_expired" : "forbidden" };
  if (verified.data.s !== slug) return { ok: false, code: "forbidden" };

  const b = await findBusinessForIntake(verified.data.b);
  if (!b) return { ok: false, code: "not_found" };
  if (!b.isActive) return { ok: false, code: "inactive" };
  return {
    ok: true,
    business: {
      id: b.id,
      name: b.name,
      slug: b.slug,
      phone: b.phone,
      services: parseJsonColumn(b.services, shortTextListSchema, []),
    },
  };
}

// ── Transcription ─────────────────────────────────────────────────────

export class NoSpeechError extends Error {
  constructor() {
    super("No speech detected");
    this.name = "NoSpeechError";
  }
}

async function requireAI(): Promise<LeadAI> {
  const ai = await getLeadAI();
  if (!ai) throw new AiUnavailableError("not_configured");
  return ai;
}

/**
 * Audio is held in memory only for this call and never written to disk or
 * the database (V1 privacy rule). Only the transcript leaves this function.
 */
export async function transcribeAudio(audio: Uint8Array, mediaType: string) {
  const ai = await requireAI();
  const result = await ai.transcribe(audio, mediaType);
  const transcript = result.transcript
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.maxTranscriptChars);
  if (!result.has_speech || transcript.length < 2) throw new NoSpeechError();
  return { transcript, language: result.language };
}

// ── Analysis (extraction + one clarifying question) ───────────────────

const extractedLeadSchema = z.object({
  customerName: z.string().nullable(),
  phone: z.string().nullable(),
  serviceNeeded: z.string().nullable(),
  preferredDate: z.string().nullable(),
  preferredDateText: z.string().nullable(),
  preferredTime: z.string().nullable(),
  notes: z.string().nullable(),
  summary: z.string(),
  urgency: z.enum(URGENCIES),
  language: z.enum(LANGUAGES),
  confidence: z.number().min(0).max(1),
  flags: z.array(z.string()),
});

const extractionTokenSchema = z.object({
  b: z.string(),
  h: z.string(),
  lead: extractedLeadSchema,
  asked: z.array(z.enum(ASKABLE_FIELDS)),
});

/** Binds an extraction to the exact conversation it was computed from. */
function conversationHash(transcript: string, turns: ConversationTurnInput[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        transcript.trim(),
        turns.map((t) => [t.role, t.content.trim(), t.field ?? null]),
      ]),
    )
    .digest("hex");
}

/** Everything the customer actually said (skipped answers excluded). */
function customerText(transcript: string, turns: ConversationTurnInput[]): string {
  return [
    transcript,
    ...turns
      .filter((t) => t.role === "customer" && t.content !== SKIPPED_ANSWER)
      .map((t) => t.content),
  ].join("\n");
}

function askedFields(turns: ConversationTurnInput[]): AskableField[] {
  return turns.flatMap((t) => (t.role === "assistant" && t.field ? [t.field] : []));
}

/** Accept the model's question only if it is short and looks like a question. */
function isUsableQuestion(text: string): boolean {
  const t = text.trim();
  return t.length > 3 && t.length <= 200 && t.split(/\s+/).length <= 25 && /[?؟]$/.test(t);
}

export async function analyzeConversation(
  business: IntakeBusiness,
  body: AnalyzeBody,
  now = new Date(),
): Promise<AnalyzeResponse> {
  const ai = await requireAI();
  const todayIso = isoDateInTimezone(now);
  const raw = await ai.extract({
    businessName: business.name,
    services: business.services,
    todayIso,
    weekday: weekdayInTimezone(now),
    transcript: body.transcript,
    turns: body.turns,
  });
  const lead = sanitizeExtraction(raw, {
    customerText: customerText(body.transcript, body.turns),
    todayIso,
  });

  const asked = askedFields(body.turns);
  const field = missingFields(lead, asked)[0];
  let question: ClarifyingQuestion | null = null;
  if (field) {
    let text = templateQuestion(field, lead.language);
    try {
      const generated = await ai.clarifyingQuestion({
        field,
        language: lead.language,
        businessName: business.name,
      });
      if (isUsableQuestion(generated)) text = generated.trim();
    } catch {
      // Template fallback keeps the conversation going if the model is slow or down.
    }
    question = { field, text, skippable: isSkippable(field) };
  }

  const extractionToken = signToken(
    "extraction",
    { b: business.id, h: conversationHash(body.transcript, body.turns), lead, asked },
    2 * 60 * 60,
  );
  return { lead, missing: missingFields(lead, asked), question, extractionToken };
}

// ── Submission ─────────────────────────────────────────────────────────

export class IntakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeValidationError";
  }
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export async function submitIntake(
  business: IntakeBusiness,
  body: SubmitBody,
  ipHash: string,
  now = new Date(),
): Promise<SubmitResponse> {
  const { fields } = body;
  const todayIso = isoDateInTimezone(now);
  if (
    fields.preferredDate &&
    !isIsoDateWithin(fields.preferredDate, todayIso, addDaysIso(todayIso, 180))
  ) {
    throw new IntakeValidationError("Please choose a date between today and the next six months.");
  }

  // Trust AI-only fields (urgency, confidence, summary) only from our own signed token,
  // issued for this clinic and this exact conversation.
  let ai: ExtractedLead | null = null;
  let asked: AskableField[] = [];
  const verifiedFlags: string[] = [];
  if (body.extractionToken) {
    const verified = verifyToken("extraction", body.extractionToken, extractionTokenSchema);
    if (
      verified.ok &&
      verified.data.b === business.id &&
      verified.data.h === conversationHash(body.transcript, body.turns)
    ) {
      ai = verified.data.lead;
      asked = verified.data.asked;
    } else {
      verifiedFlags.push("AI analysis could not be verified; treated as a manual request.");
    }
  }

  const text = customerText(body.transcript, body.turns);
  const urgency = ai?.urgency ?? (hasRedFlag(text) ? "high" : "normal");
  const flags = [...(ai?.flags ?? []), ...verifiedFlags];
  const status: LeadStatus =
    !ai || ai.confidence < 0.75 || flags.length > 0 || !fields.customerName
      ? "needs_review"
      : "new";

  // Per-field provenance: unchanged AI values stay "ai" (or "customer" if they came
  // from an answered question); anything the customer typed or changed is "customer".
  const sourceFor = (
    field: AskableField | null,
    aiValue: string | null,
    finalValue: string | null,
  ): FieldSource => {
    if (!ai) return "customer";
    if (!same(aiValue, finalValue)) return "customer";
    return field && asked.includes(field) ? "customer" : "ai";
  };
  const fieldRow = (
    fieldName: LeadFieldName,
    value: string | null,
    field: AskableField | null,
    aiValue: string | null,
  ) => {
    const source = sourceFor(field, aiValue, value);
    return {
      fieldName,
      value,
      source,
      confidence: value === null ? null : source === "ai" ? (ai?.confidence ?? null) : 1,
    };
  };

  const deletionToken = randomBytes(32).toString("base64url");
  const created = await createLead({
    businessId: business.id,
    customerName: fields.customerName,
    phone: fields.phone,
    serviceNeeded: fields.serviceNeeded,
    urgency,
    preferredDate: fields.preferredDate,
    preferredDateText:
      ai && same(ai.preferredDate, fields.preferredDate) ? ai.preferredDateText : null,
    preferredTime: fields.preferredTime,
    summary: ai?.summary ?? `Request submitted with the short form: ${fields.serviceNeeded}.`,
    transcript: body.transcript,
    language: ai?.language ?? detectLanguage(text),
    aiConfidence: ai?.confidence ?? null,
    status,
    deletionTokenHash: createHash("sha256").update(deletionToken).digest("hex"),
    deletionExpiresAt: new Date(now.getTime() + LIMITS.deletionWindowHours * 60 * 60 * 1000),
    fields: [
      fieldRow("customer_name", fields.customerName, "customerName", ai?.customerName ?? null),
      fieldRow("phone", fields.phone, "phone", ai?.phone ?? null),
      fieldRow("service_needed", fields.serviceNeeded, "serviceNeeded", ai?.serviceNeeded ?? null),
      fieldRow("preferred_date", fields.preferredDate, "preferredDate", ai?.preferredDate ?? null),
      fieldRow("preferred_time", fields.preferredTime, "preferredTime", ai?.preferredTime ?? null),
      fieldRow("notes", fields.notes, null, ai?.notes ?? null),
      ...(ai
        ? [
            {
              fieldName: "urgency" as const,
              value: urgency,
              source: "ai" as const,
              confidence: ai.confidence,
            },
          ]
        : []),
    ],
    turns: [
      { role: "customer", content: body.transcript },
      ...body.turns.map((t) => ({ role: t.role, content: t.content })),
    ],
    ipHash,
    auditMetadata: { source: "intake", mode: ai ? "ai" : "manual", flags: flags.length },
  });

  return { referenceNumber: created.referenceNumber, deletionToken, urgency };
}
