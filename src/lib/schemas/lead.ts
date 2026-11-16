import { z } from "zod";
import { LEAD_STATUSES, LIMITS, URGENCIES } from "../constants";
import { isoDateSchema, pkPhoneSchema, timeSchema } from "../validation";

/** Lead list filters (tabs). "priority" = high + emergency, still open. */
export const LEAD_FILTERS = [
  "all",
  "priority",
  "new",
  "needs_review",
  "ready_to_contact",
  "contacted",
  "booked",
  "lost",
] as const;
export type LeadFilter = (typeof LEAD_FILTERS)[number];

/** Query string for /dashboard/leads. Invalid values fall back to defaults, never error. */
export const leadListQuerySchema = z.object({
  filter: z.enum(LEAD_FILTERS).catch("all"),
  q: z
    .string()
    .trim()
    .max(80)
    .catch("")
    .transform((v) => v || null),
  sort: z.enum(["urgent", "newest"]).catch("urgent"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

/** First value of a possibly repeated search param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** Staff edits to the extracted fields. */
export const leadFieldsUpdateSchema = z.object({
  customerName: optionalText(80),
  phone: pkPhoneSchema,
  serviceNeeded: z.string().trim().min(2, "Describe what the patient needs").max(80),
  urgency: z.enum(URGENCIES),
  preferredDate: z.union([isoDateSchema, z.literal("")]).transform((v) => v || null),
  preferredTime: z.union([timeSchema, z.literal("")]).transform((v) => v || null),
  notes: optionalText(LIMITS.maxInternalNotesChars),
  summary: optionalText(500),
});
export type LeadFieldsUpdate = z.infer<typeof leadFieldsUpdateSchema>;

export const leadIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+$/i);

export const statusChangeSchema = z.object({
  leadId: leadIdSchema,
  to: z.enum(LEAD_STATUSES),
});

export const internalNotesSchema = z.object({
  leadId: leadIdSchema,
  internalNotes: optionalText(LIMITS.maxInternalNotesChars),
});

export const followUpSaveSchema = z.object({
  leadId: leadIdSchema,
  message: z
    .string()
    .trim()
    .min(1)
    .max(LIMITS.maxFollowUpChars, `Keep it under ${LIMITS.maxFollowUpChars} characters`),
});
