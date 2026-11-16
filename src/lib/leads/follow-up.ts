import { DEFAULT_TIMEZONE, LIMITS } from "@/lib/constants";
import type { FollowUpTone, Language, LeadStatus } from "@/types/domain";

export interface FollowUpInput {
  clinicName: string;
  clinicPhone: string; // display format
  customerName: string | null;
  service: string | null;
  preferredDate: string | null; // YYYY-MM-DD
  preferredTime: string | null; // HH:mm
  status: LeadStatus;
  language: Language;
  tone: FollowUpTone;
}

/** "Tue 17 Nov" — short, unambiguous, readable in any of the three languages. */
export function formatDateForMessage(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

/** "17:00" → "5:00 PM". */
export function formatTimeForMessage(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h ?? 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function when(input: FollowUpInput): string | null {
  const date = input.preferredDate ? formatDateForMessage(input.preferredDate) : null;
  const time = input.preferredTime ? formatTimeForMessage(input.preferredTime) : null;
  if (date && time) return `${date}, ${time}`;
  return date ?? time;
}

/**
 * Deterministic follow-up message. Used when the AI is unavailable and as the
 * reference shape for AI output. Never claims an appointment is confirmed
 * unless the clinic has marked it booked.
 */
export function buildFollowUpTemplate(input: FollowUpInput): string {
  const slot = when(input);
  const booked = input.status === "booked" && slot;
  const name = input.customerName?.trim();
  const service = input.service?.toLowerCase() ?? null;
  const concise = input.tone === "concise";
  const formal = input.tone === "formal";

  if (input.language === "ur") {
    const greeting = name ? `السلام علیکم ${name}،` : "السلام علیکم،";
    const intro = `${input.clinicName} سے رابطہ کر رہے ہیں۔`;
    const body = booked
      ? `آپ کی اپائنٹمنٹ ${slot} کے لیے بک ہو گئی ہے۔`
      : `آپ کا پیغام مل گیا ہے${slot ? `۔ آپ نے ${slot} کا وقت مانگا تھا، ہم دستیابی دیکھ کر بتاتے ہیں` : ""}۔`;
    const close = booked
      ? "کسی تبدیلی کے لیے اسی نمبر پر جواب دیں۔"
      : "براہ کرم جواب دیں تاکہ ہم آپ کے لیے وقت طے کر سکیں۔";
    return [greeting, intro, body, concise ? "" : close]
      .filter(Boolean)
      .join(" ")
      .slice(0, LIMITS.maxFollowUpChars);
  }

  if (input.language === "mixed") {
    const greeting = name ? `Assalam o alaikum ${name},` : "Assalam o alaikum,";
    const intro = `${input.clinicName} se baat kar rahe hain.`;
    const body = booked
      ? `Aap ki appointment ${slot} ke liye book ho gayi hai.`
      : `Aap ka ${service ? `${service} ke baare mein ` : ""}message mil gaya hai.${
          slot ? ` Aap ne ${slot} ka waqt kaha tha, hum availability check kar ke batate hain.` : ""
        }`;
    const close = booked
      ? "Koi tabdeeli ho to isi number par reply karein."
      : `Please reply karein taake hum aap ke liye waqt tay kar sakein, ya ${input.clinicPhone} par call karein.`;
    return [greeting, intro, body, concise ? "" : close]
      .filter(Boolean)
      .join(" ")
      .slice(0, LIMITS.maxFollowUpChars);
  }

  const greeting = formal ? `Dear ${name ?? "patient"},` : name ? `Hi ${name},` : "Hello,";
  const intro = `This is ${input.clinicName}.`;
  const body = booked
    ? `Your appointment is booked for ${slot}.`
    : `Thank you for your message${service ? ` about ${service}` : ""}.${
        slot ? ` You asked for ${slot}; we'll check availability and get back to you.` : ""
      }`;
  const close = booked
    ? "Reply here if you need to change it."
    : `Please reply with a time that suits you, or call us on ${input.clinicPhone}.`;
  return [greeting, intro, body, concise ? "" : close]
    .filter(Boolean)
    .join(" ")
    .slice(0, LIMITS.maxFollowUpChars);
}

/** Phrases that claim a booking. Only allowed once the clinic marked the lead booked. */
const CONFIRMATION_CLAIMS = [
  /\b(is|has been|have been|are)\s+(now\s+)?(confirmed|booked|scheduled)\b/i,
  /\bappointment\s+(is\s+)?confirmed\b/i,
  /\bconfirm(ed)? ho (gayi|gaya|gai)\b/i,
  /\bbook ho (gayi|gaya|gai)\b/i,
  /کنفرم ہو گئ/,
  /بک ہو گئ/,
];

/**
 * Server-side check on AI-written messages: too long, empty, or claiming a
 * confirmed appointment that the clinic has not booked → reject (use template).
 */
export function followUpProblem(message: string, status: LeadStatus): string | null {
  const text = message.trim();
  if (text.length < 10) return "empty";
  if (text.length > LIMITS.maxFollowUpChars) return "too_long";
  if (status !== "booked" && CONFIRMATION_CLAIMS.some((re) => re.test(text)))
    return "claims_confirmation";
  return null;
}

/** wa.me link with the message pre-filled; the staff member still presses Send in WhatsApp. */
export function whatsappLink(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
