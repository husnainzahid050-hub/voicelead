/**
 * Post-processing for AI output. Pure functions (unit-tested): the model's
 * answer is treated as a suggestion, and these rules decide what survives.
 */
import { addDaysIso, isIsoDateWithin } from "@/lib/dates";
import { detectLanguage } from "@/lib/intake/language";
import type { ExtractedLead } from "@/lib/intake/types";
import { normalizePkPhone, toAsciiDigits } from "@/lib/phone";
import { URGENCY_RANK } from "@/lib/constants";
import type { Urgency } from "@/types/domain";
import type { AiExtraction } from "./schemas";

/** How far ahead a preferred date may be. Beyond this it's more likely a mistake. */
const MAX_DAYS_AHEAD = 180;

/**
 * Red-flag words (English, Roman Urdu, Urdu). If any appear, urgency is at
 * least "high" whatever the model said — a missed emergency costs far more
 * than an over-cautious label the receptionist can lower.
 */
/**
 * Latin-script terms are matched as whole words (with their common endings):
 * a plain substring test made "toot" (Roman Urdu: broken) match "tooth",
 * which flagged nearly every dental message as urgent.
 */
const LATIN_RED_FLAGS = [
  /\bswell(ing|ed|s)?\b/,
  /\bswollen\b/,
  /\bbleed(ing|s)?\b/,
  /\bblood(y)?\b/,
  /\baccident\b/,
  /\bbroken?\b/,
  /\bfracture[ds]?\b/,
  /\bcan'?t open\b/,
  /\bcannot open\b/,
  /\bfever\b/,
  /\bpus\b/,
  /\bsooj(a|i|an|gaya|gayi)?\b/,
  /\bkhoon\b/,
  /\btoot(a|i|ay|e|gaya|gayi)?\b/,
  /\bbukhar\b/,
];

/** Urdu script has no word-boundary concept in JS regex; these stems are distinctive. */
const URDU_RED_FLAGS = ["سوج", "خون", "ٹوٹ", "بخار", "پیپ", "حادثہ"];

export function normalizeForMatch(text: string): string {
  return toAsciiDigits(text).toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function hasRedFlag(text: string): boolean {
  const t = normalizeForMatch(text);
  return LATIN_RED_FLAGS.some((re) => re.test(t)) || URDU_RED_FLAGS.some((w) => t.includes(w));
}

/**
 * The summary is model-written text that staff read and act on, so treat it
 * as untrusted: drop links, and phone numbers the customer never said
 * (a prompt-injection attempt could otherwise plant "call this number").
 */
export function sanitizeSummary(summary: string, customerText: string): string {
  const sourceDigits = toAsciiDigits(customerText).replace(/\D/g, "");
  return summary
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]")
    .replace(/\+?\d[\d\s-]{6,}\d/g, (match) => {
      const digits = match.replace(/\D/g, "").replace(/^(0092|92|0)/, "");
      return digits.length >= 7 && sourceDigits.includes(digits) ? match : "[number removed]";
    });
}

function clean(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(/\s+/g, " ").trim();
  if (!v || /^(null|none|n\/a|unknown)$/i.test(v)) return null;
  return v.slice(0, max);
}

export interface GuardContext {
  /** Everything the customer said (transcript + answers). Assistant text excluded. */
  customerText: string;
  todayIso: string;
}

/**
 * Turn raw model output into a trustworthy ExtractedLead:
 * - names and phone numbers must literally appear in what the customer said
 * - phone numbers are normalised to E.164 (Pakistani formats only)
 * - dates must be today..+180 days; times must be HH:mm
 * - urgency is raised to "high" when red-flag symptoms are mentioned
 * - every adjustment is recorded in `flags` for staff
 */
export function sanitizeExtraction(raw: AiExtraction, ctx: GuardContext): ExtractedLead {
  const flags: string[] = [];
  const source = normalizeForMatch(ctx.customerText);
  const sourceDigits = toAsciiDigits(ctx.customerText).replace(/\D/g, "");
  let confidence = Number.isFinite(raw.confidence) ? Math.min(1, Math.max(0, raw.confidence)) : 0.5;

  // Name: must appear in what the customer actually said.
  let customerName = clean(raw.customer_name, 80);
  if (
    customerName &&
    (/\d/.test(customerName) || !source.includes(normalizeForMatch(customerName)))
  ) {
    flags.push("AI suggested a name the customer did not say; removed.");
    customerName = null;
    confidence -= 0.1;
  }

  // Phone: valid Pakistani number whose digits the customer actually said.
  let phone: string | null = null;
  const rawPhone = clean(raw.phone, 32);
  if (rawPhone) {
    const normalized = normalizePkPhone(rawPhone);
    const nationalDigits = normalized?.e164.replace(/^\+92/, "") ?? "";
    if (normalized && sourceDigits.includes(nationalDigits)) {
      phone = normalized.e164;
    } else {
      flags.push("Phone number could not be verified from the message; removed.");
      confidence -= 0.1;
    }
  }

  // Date: real ISO date in a sensible window, else keep only the words.
  let preferredDate = clean(raw.preferred_date, 10);
  if (
    preferredDate &&
    !isIsoDateWithin(preferredDate, ctx.todayIso, addDaysIso(ctx.todayIso, MAX_DAYS_AHEAD))
  ) {
    flags.push("Preferred date was outside the allowed range; removed.");
    preferredDate = null;
  }

  let preferredTime = clean(raw.preferred_time, 5);
  if (preferredTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime)) preferredTime = null;

  // Urgency in both directions:
  //  - floor: warning symptoms make it at least "high" (missed emergencies are costly)
  //  - ceiling: "emergency" needs a warning symptom in the patient's own words, so
  //    text typed into the public form can't simply instruct the model to jump the queue.
  let urgency: Urgency = raw.urgency;
  const redFlag = hasRedFlag(ctx.customerText);
  if (redFlag && URGENCY_RANK[urgency] < URGENCY_RANK.high) {
    flags.push("Urgency raised to high: the message mentions a warning symptom.");
    urgency = "high";
  } else if (!redFlag && urgency === "emergency") {
    flags.push("Marked high, not emergency: no warning symptom found in the patient's words.");
    urgency = "high";
  }

  // Language: trust the script we can see over the model's guess.
  const detected = detectLanguage(ctx.customerText);
  const language =
    detected === "ur" || detected === "mixed"
      ? raw.language === "en"
        ? detected
        : raw.language
      : raw.language;

  const summary = sanitizeSummary(
    clean(raw.summary, 500) ?? ctx.customerText.slice(0, 200),
    ctx.customerText,
  );

  return {
    customerName,
    phone,
    serviceNeeded: clean(raw.service_needed, 80),
    preferredDate,
    preferredDateText: clean(raw.preferred_date_text, 60),
    preferredTime,
    notes: clean(raw.notes, 1000),
    summary,
    urgency,
    language,
    confidence: Math.round(Math.max(0, confidence) * 100) / 100,
    flags,
  };
}
