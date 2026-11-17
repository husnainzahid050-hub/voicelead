import type { Language } from "@/types/domain";
import type { AskableField, ClarifyingQuestion, CustomerFields } from "./types";
import { ASKABLE_FIELDS } from "./types";

/**
 * Template questions: used when the AI is unavailable or returns something
 * unusable, and by the deterministic mock provider. "ur" uses Urdu script,
 * "mixed" uses Roman Urdu (how most people type Urdu on WhatsApp).
 */
const TEMPLATES: Record<AskableField, Record<Language, string>> = {
  customerName: {
    en: "May I have your name, please?",
    ur: "آپ کا نام کیا ہے؟",
    mixed: "Aap ka naam kya hai?",
  },
  phone: {
    en: "What is your WhatsApp number, so the clinic can reply?",
    ur: "آپ کا واٹس ایپ نمبر کیا ہے تاکہ کلینک آپ سے رابطہ کر سکے؟",
    mixed: "Aap ka WhatsApp number kya hai, taake clinic aap se rabta kar sake?",
  },
  serviceNeeded: {
    en: "What would you like help with, for example a checkup, cleaning or tooth pain?",
    ur: "آپ کو کس چیز میں مدد چاہیے، جیسے چیک اپ، صفائی یا دانت کا درد؟",
    mixed: "Aap ko kis cheez mein madad chahiye, jaise checkup, safai ya daant ka dard?",
  },
  preferredDate: {
    en: "Which day would you like to come in?",
    ur: "آپ کس دن آنا چاہیں گے؟",
    mixed: "Aap kis din aana chahenge?",
  },
  preferredTime: {
    en: "What time of day suits you best?",
    ur: "آپ کے لیے کون سا وقت بہتر رہے گا؟",
    mixed: "Aap ke liye kaun sa waqt behtar rahega?",
  },
};

export function templateQuestion(field: AskableField, language: Language): string {
  return TEMPLATES[field][language];
}

/** Phone is the only field without which the clinic cannot follow up. */
export function isSkippable(field: AskableField): boolean {
  return field !== "phone";
}

/**
 * Fields still missing, in the order they should be asked. Fields the
 * customer already skipped (or was already asked about) are not asked again,
 * so the conversation always ends.
 */
export function missingFields(
  fields: CustomerFields,
  alreadyAsked: AskableField[],
): AskableField[] {
  return ASKABLE_FIELDS.filter((f) => {
    if (fields[f]) return false;
    // A preferred time only makes sense once there is a day (or the customer skipped it).
    if (f === "preferredTime" && !fields.preferredDate && !alreadyAsked.includes("preferredDate")) {
      return false;
    }
    // Ask each field at most once, except phone: without it there is no lead.
    return f === "phone"
      ? alreadyAsked.filter((a) => a === "phone").length < 2
      : !alreadyAsked.includes(f);
  });
}

export function nextTemplateQuestion(
  fields: CustomerFields,
  alreadyAsked: AskableField[],
  language: Language,
): Omit<ClarifyingQuestion, "sig"> | null {
  const field = missingFields(fields, alreadyAsked)[0];
  if (!field) return null;
  return { field, text: templateQuestion(field, language), skippable: isSkippable(field) };
}
