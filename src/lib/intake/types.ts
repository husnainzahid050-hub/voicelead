/**
 * Types shared by the public intake page (client) and the intake API (server).
 * Everything here crosses the network, so it is plain JSON-safe data.
 */
import type { Language, TurnRole, Urgency } from "@/types/domain";

/** Fields the customer can see and correct. */
export interface CustomerFields {
  customerName: string | null;
  phone: string | null; // E.164 once validated
  serviceNeeded: string | null;
  preferredDate: string | null; // YYYY-MM-DD
  preferredTime: string | null; // HH:mm
  notes: string | null;
}

/** The AI's structured reading of the conversation, after server-side guards. */
export interface ExtractedLead extends CustomerFields {
  preferredDateText: string | null;
  urgency: Urgency;
  summary: string;
  language: Language;
  confidence: number; // 0..1
  /** Human-readable reasons the server adjusted the AI output (for staff review). */
  flags: string[];
}

/** Fields the intake flow may ask a clarifying question about, in priority order. */
export const ASKABLE_FIELDS = [
  "customerName",
  "phone",
  "serviceNeeded",
  "preferredDate",
  "preferredTime",
] as const;
export type AskableField = (typeof ASKABLE_FIELDS)[number];

/** Customer turn content recorded when a question is skipped. Never a real answer. */
export const SKIPPED_ANSWER = "(skipped)";

export interface ConversationTurnInput {
  role: TurnRole;
  content: string;
  /** For assistant turns: which field the question asked about. */
  field?: AskableField;
  /** For assistant turns: the server's signature for this question. */
  sig?: string;
}

export interface ClarifyingQuestion {
  field: AskableField;
  text: string;
  /** Whether the customer may skip it (phone is never skippable). */
  skippable: boolean;
  /** Echo this back on the assistant turn; unsigned assistant turns are rejected. */
  sig: string;
}

export type IntakeErrorCode =
  | "invalid_input"
  | "not_found"
  | "inactive"
  | "session_expired"
  | "rate_limited"
  | "ai_unavailable"
  | "no_speech"
  | "payload_too_large"
  | "unsupported_media"
  | "forbidden"
  | "server_error";

export interface IntakeErrorBody {
  error: { code: IntakeErrorCode; message: string };
}

export interface TranscribeResponse {
  transcript: string;
  language: Language;
}

export interface AnalyzeResponse {
  lead: ExtractedLead;
  missing: AskableField[];
  question: ClarifyingQuestion | null;
  /** Signed copy of `lead` so the server can trust AI-only fields at submit time. */
  extractionToken: string;
}

export interface SubmitResponse {
  referenceNumber: string;
  /** Shown once; lets the customer request deletion within 24 hours. */
  deletionToken: string;
  urgency: Urgency;
}
