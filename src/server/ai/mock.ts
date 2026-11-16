import "server-only";
import { addDaysIso } from "@/lib/dates";
import { detectLanguage } from "@/lib/intake/language";
import { templateQuestion } from "@/lib/intake/questions";
import { SKIPPED_ANSWER, type ConversationTurnInput } from "@/lib/intake/types";
import { toAsciiDigits } from "@/lib/phone";
import type { Urgency } from "@/types/domain";
import type { ExtractionInput, LeadAI, QuestionInput } from "./provider";
import type { AiExtraction, AiTranscription } from "./schemas";

/**
 * Deterministic, rule-based stand-in for Gemini. Used by automated tests
 * (AI_PROVIDER=mock) so the full intake flow can be exercised without a key
 * or network. Not intended for real patients.
 */
export const MOCK_TRANSCRIPT = "Meri daant mein bohat dard ho raha hai. Kal appointment chahiye.";

const SERVICE_RULES: Array<{ match: RegExp; service: string }> = [
  { match: /root canal/i, service: "Root canal" },
  { match: /braces|tedhe|crooked/i, service: "Braces consultation" },
  { match: /filling|cavity|keera|کیڑا/i, service: "Filling" },
  { match: /safai|clean|scaling|polish/i, service: "Cleaning" },
  { match: /dard|pain|sooj|swell|درد/i, service: "Emergency dental pain" },
  { match: /checkup|check-up|chek/i, service: "Dental checkup" },
];

function customerText(input: Pick<ExtractionInput, "transcript" | "turns">): string {
  return [
    input.transcript,
    ...input.turns.filter((t) => t.role === "customer").map((t) => t.content),
  ].join(" \n");
}

/** The customer's reply to the most recent question about `field`, if any. */
function answerTo(turns: ConversationTurnInput[], field: string): string | null {
  for (let i = turns.length - 1; i > 0; i--) {
    const prev = turns[i - 1];
    const turn = turns[i];
    if (turn?.role === "customer" && prev?.role === "assistant" && prev.field === field) {
      return turn.content === SKIPPED_ANSWER ? null : turn.content;
    }
  }
  return null;
}

function findName(text: string, turns: ConversationTurnInput[]): string | null {
  const said = text.match(
    /(?:mera naam|my name is|i am|i'm|naam)\s+([A-Za-z؀-ۿ]+(?:\s+(?!hai\b|hoon\b|is\b)[A-Za-z؀-ۿ]+)?)/i,
  );
  if (said?.[1]) return said[1].trim();
  const answer = answerTo(turns, "customerName");
  if (!answer) return null;
  const cleaned = answer
    .replace(/mera naam|my name is|i am|i'm|\bhai\b|\.|,/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && !/\d/.test(cleaned) && cleaned.split(" ").length <= 3 ? cleaned : null;
}

function findPhone(text: string): string | null {
  const match = toAsciiDigits(text).match(/(?:\+?92|0)?[\s-]?3\d{2}[\s-]?\d{7}/);
  return match ? match[0].replace(/[\s-]/g, "") : null;
}

function findDate(text: string, todayIso: string): { iso: string | null; words: string | null } {
  const t = text.toLowerCase();
  if (/\b(parson|day after tomorrow)\b|پرسوں/.test(t))
    return { iso: addDaysIso(todayIso, 2), words: "parson" };
  if (/\b(kal|tomorrow)\b|کل/.test(t))
    return { iso: addDaysIso(todayIso, 1), words: t.includes("tomorrow") ? "tomorrow" : "kal" };
  if (/\b(aaj|today)\b|آج/.test(t))
    return { iso: todayIso, words: t.includes("today") ? "today" : "aaj" };
  return { iso: null, words: null };
}

function findTime(text: string): string | null {
  const t = toAsciiDigits(text).toLowerCase();
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(baje|pm|am)\b/);
  if (!m?.[1]) return null;
  let hour = Number(m[1]);
  const minutes = m[2] ?? "00";
  const evening = m[3] === "pm" || /shaam|evening|raat|dopehar/.test(t);
  if (evening && hour < 12) hour += 12;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function findUrgency(text: string, service: string | null): Urgency {
  if (/sooj|swell|bleed|khoon|broken|toot|ٹوٹ|خون|سوج/i.test(text)) return "emergency";
  if (/dard|pain|درد/i.test(text)) return "high";
  if (service === "Cleaning" || service === "Braces consultation" || service === "Dental checkup")
    return "low";
  return "normal";
}

export class MockLeadAI implements LeadAI {
  readonly name = "mock" as const;

  async transcribe(audio: Uint8Array): Promise<AiTranscription> {
    const hasSpeech = audio.byteLength >= 1000;
    return {
      transcript: hasSpeech ? MOCK_TRANSCRIPT : "",
      language: "mixed",
      has_speech: hasSpeech,
      corrections: [],
    };
  }

  async extract(input: ExtractionInput): Promise<AiExtraction> {
    const text = customerText(input);
    const service = SERVICE_RULES.find((r) => r.match.test(text))?.service ?? null;
    const date = findDate(text, input.todayIso);
    const urgency = findUrgency(text, service);
    const name = findName(text, input.turns);
    const phone = findPhone(text);
    const time = findTime(text);
    const missing = [
      !name && "customer_name",
      !phone && "phone",
      !service && "service_needed",
      !date.iso && "preferred_date",
      !time && "preferred_time",
    ].filter((v): v is string => typeof v === "string");

    return {
      customer_name: name,
      phone,
      service_needed: service,
      urgency,
      preferred_date: date.iso,
      preferred_date_text: date.words,
      preferred_time: time,
      notes: input.transcript.slice(0, 300),
      summary: `${urgency === "emergency" ? "URGENT: contact this patient as soon as possible. " : ""}Patient requests ${
        service?.toLowerCase() ?? "help"
      }${date.words ? ` (${date.words})` : ""}.`,
      language: detectLanguage(text),
      confidence: 0.85,
      missing_fields: missing,
    };
  }

  async clarifyingQuestion(input: QuestionInput): Promise<string> {
    return templateQuestion(input.field, input.language);
  }
}
