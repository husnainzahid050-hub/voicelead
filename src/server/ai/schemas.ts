import { z } from "zod";
import { LANGUAGES, URGENCIES } from "@/lib/constants";

/**
 * Raw shapes the model must return. Every AI response is parsed through one
 * of these (the AI SDK validates; we validate again in guards.ts) before any
 * value can reach the database.
 */

export const aiTranscriptionSchema = z.object({
  transcript: z.string().describe("Verbatim transcript of what the speaker said."),
  language: z
    .enum(LANGUAGES)
    .describe("ur = Urdu, en = English, mixed = Urdu/English mix or Roman Urdu"),
  has_speech: z
    .boolean()
    .describe("false if the recording is silent or has no intelligible speech"),
  corrections: z
    .array(z.string())
    .describe("Words you were unsure about and how you interpreted them; empty if none"),
});
export type AiTranscription = z.infer<typeof aiTranscriptionSchema>;

export const aiExtractionSchema = z.object({
  customer_name: z.string().nullable().describe("Name exactly as the customer said it, else null"),
  phone: z.string().nullable().describe("Phone number exactly as said, digits only, else null"),
  service_needed: z.string().nullable().describe("Short description of the dental service needed"),
  urgency: z.enum(URGENCIES),
  preferred_date: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD if a specific day can be resolved, else null"),
  preferred_date_text: z
    .string()
    .nullable()
    .describe("The customer's own words for the day, e.g. 'kal'"),
  preferred_time: z.string().nullable().describe("HH:mm 24-hour if stated, else null"),
  notes: z.string().nullable().describe("Relevant details for the clinic, no diagnosis"),
  summary: z.string().describe("One or two sentences for clinic staff, in English"),
  language: z.enum(LANGUAGES),
  confidence: z.number().describe("0 to 1: how sure you are about the extracted fields"),
  missing_fields: z.array(z.string()),
});
export type AiExtraction = z.infer<typeof aiExtractionSchema>;

export const aiQuestionSchema = z.object({
  question: z.string().describe("One short question, under 25 words, in the customer's language"),
});

export const aiFollowUpSchema = z.object({
  message: z.string().describe("The WhatsApp message text only"),
});
