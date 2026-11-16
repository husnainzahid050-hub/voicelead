import "server-only";
import { env } from "@/lib/env";
import type { AskableField, ConversationTurnInput } from "@/lib/intake/types";
import type { FollowUpInput } from "@/lib/leads/follow-up";
import type { Language } from "@/types/domain";
import type { AiExtraction, AiTranscription } from "./schemas";

/**
 * The application's view of "the AI". Gemini has no database access: it
 * receives text/audio and returns validated JSON; the app decides what to store.
 */
export interface LeadAI {
  readonly name: "gemini" | "mock";
  transcribe(audio: Uint8Array, mediaType: string): Promise<AiTranscription>;
  extract(input: ExtractionInput): Promise<AiExtraction>;
  clarifyingQuestion(input: QuestionInput): Promise<string>;
  /** WhatsApp-style follow-up. Output is checked by followUpProblem() before use. */
  followUpMessage(input: FollowUpInput): Promise<string>;
}

export interface ExtractionInput {
  businessName: string;
  services: string[];
  todayIso: string;
  weekday: string;
  transcript: string;
  turns: ConversationTurnInput[];
}

export interface QuestionInput {
  field: AskableField;
  language: Language;
  businessName: string;
}

/** Thrown for any provider failure. Callers show a friendly message and offer the short form. */
export class AiUnavailableError extends Error {
  constructor(reason: string) {
    super(`AI unavailable: ${reason}`);
    this.name = "AiUnavailableError";
  }
}

let cached: LeadAI | null | undefined;

/** The configured provider, or null when Gemini is selected but no key is set. */
export async function getLeadAI(): Promise<LeadAI | null> {
  if (cached !== undefined) return cached;
  if (env.AI_PROVIDER === "mock") {
    const { MockLeadAI } = await import("./mock");
    cached = new MockLeadAI();
  } else if (env.GEMINI_API_KEY) {
    const { GeminiLeadAI } = await import("./gemini");
    cached = new GeminiLeadAI(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  } else {
    cached = null;
  }
  return cached;
}
