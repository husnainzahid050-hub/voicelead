import { z } from "zod";
import { LIMITS } from "../constants";
import { ASKABLE_FIELDS } from "../intake/types";
import { isoDateSchema, pkPhoneSchema, timeSchema, turnRoleSchema } from "../validation";

const MAX_TURNS = 12;

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const turnSchema = z.object({
  role: turnRoleSchema,
  content: z.string().trim().min(1).max(LIMITS.maxAnswerChars),
  field: z.enum(ASKABLE_FIELDS).optional(),
});

export const transcriptSchema = z
  .string()
  .trim()
  .min(2, "Please tell us a little about what you need.")
  .max(LIMITS.maxTranscriptChars, "That message is too long. Please keep it shorter.");

/** POST /api/intake/[slug]/analyze */
export const analyzeBodySchema = z.object({
  transcript: transcriptSchema,
  turns: z.array(turnSchema).max(MAX_TURNS).default([]),
});

/** Fields the customer confirms on the review screen. */
export const customerFieldsSchema = z.object({
  customerName: nullableText(80),
  phone: pkPhoneSchema,
  serviceNeeded: z.string().trim().min(2, "Tell us what you need help with").max(80),
  preferredDate: z
    .union([isoDateSchema, z.literal("")])
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  preferredTime: z
    .union([timeSchema, z.literal("")])
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  notes: nullableText(LIMITS.maxInternalNotesChars),
});

/** POST /api/intake/[slug]/submit */
export const submitBodySchema = z.object({
  transcript: transcriptSchema,
  turns: z.array(turnSchema).max(MAX_TURNS).default([]),
  fields: customerFieldsSchema,
  /** Absent when the AI was unavailable and the customer used the short form. */
  extractionToken: z.string().max(12_000).optional(),
  consent: z.literal(true, "Please agree to share your request with the clinic."),
});

export type AnalyzeBody = z.infer<typeof analyzeBodySchema>;
export type SubmitBody = z.infer<typeof submitBodySchema>;

/** POST /api/intake/[slug]/delete — the customer's own deletion request. */
export const deleteRequestBodySchema = z.object({
  referenceNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^VL-[23456789A-HJ-KM-NP-Z]{6}$/),
  deletionToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

/** Accepted recording formats (Chrome/Edge: webm, Firefox: ogg, Safari: mp4). */
export const AUDIO_MEDIA_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/x-m4a",
] as const;

/** "audio/webm;codecs=opus" → "audio/webm"; null when not allowed. */
export function normalizeAudioMediaType(raw: string): (typeof AUDIO_MEDIA_TYPES)[number] | null {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return (AUDIO_MEDIA_TYPES as readonly string[]).includes(base)
    ? (base as (typeof AUDIO_MEDIA_TYPES)[number])
    : null;
}
