/**
 * Shared Zod schemas. Every external input (forms, JSON bodies, query params,
 * AI output, JSON database columns) is parsed through a schema from here or a
 * feature-specific module that builds on these primitives.
 */
import { z } from "zod";
import {
  BUSINESS_TYPES,
  FIELD_SOURCES,
  FOLLOW_UP_TONES,
  LANGUAGES,
  LEAD_STATUSES,
  TURN_ROLES,
  URGENCIES,
  USER_ROLES,
  WEEKDAYS,
} from "./constants";
import { normalizePkPhone } from "./phone";

export const leadStatusSchema = z.enum(LEAD_STATUSES);
export const urgencySchema = z.enum(URGENCIES);
export const languageSchema = z.enum(LANGUAGES);
export const userRoleSchema = z.enum(USER_ROLES);
export const businessTypeSchema = z.enum(BUSINESS_TYPES);
export const followUpToneSchema = z.enum(FOLLOW_UP_TONES);
export const fieldSourceSchema = z.enum(FIELD_SOURCES);
export const turnRoleSchema = z.enum(TURN_ROLES);

/** "HH:mm", 24-hour. */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)");

/** "YYYY-MM-DD" that is a real calendar date. */
export const isoDateSchema = z.iso.date();

/** Accepts any reasonable Pakistani format; outputs E.164. */
export const pkPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePkPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Pakistani phone number" });
      return z.NEVER;
    }
    return normalized.e164;
  });

export const slugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single dashes only");

const dayHoursSchema = z
  .object({
    day: z.enum(WEEKDAYS),
    open: timeSchema,
    close: timeSchema,
  })
  .refine((d) => d.open < d.close, { message: "Closing time must be after opening time" });

/** Business.workingHours column. Days that are closed are simply absent. */
export const workingHoursSchema = z
  .array(dayHoursSchema)
  .max(7)
  .refine((days) => new Set(days.map((d) => d.day)).size === days.length, {
    message: "Each day may appear only once",
  });

export type WorkingHours = z.infer<typeof workingHoursSchema>;

/** Business.services and Business.commonQuestions columns. */
export const shortTextListSchema = z.array(z.string().trim().min(1).max(120)).max(30);

/**
 * Parse a JSON string column through a schema. Returns `fallback` (and never
 * throws) if the stored value is corrupt, so one bad row cannot crash a page.
 */
export function parseJsonColumn<T>(
  raw: string | null | undefined,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  if (!raw) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
