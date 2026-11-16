import type { Language } from "@/types/domain";

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿ]/;

/** Common Roman-Urdu words; two or more hits means the text is Roman Urdu / mixed. */
const ROMAN_URDU = new Set([
  "hai",
  "hain",
  "mein",
  "mera",
  "meri",
  "mujhe",
  "chahiye",
  "kal",
  "aaj",
  "daant",
  "dard",
  "baje",
  "shaam",
  "subah",
  "karwana",
  "karwani",
  "naam",
  "aap",
  "nahi",
  "bohat",
  "please",
]);

/**
 * Cheap, deterministic language guess. Used for the manual (no-AI) path and
 * as a sanity check on the AI's own detection.
 *   Urdu script only          → "ur"
 *   Urdu script + Latin words → "mixed"
 *   Roman Urdu                → "mixed"
 *   otherwise                 → "en"
 */
export function detectLanguage(text: string): Language {
  const hasArabicScript = ARABIC_SCRIPT.test(text);
  const latinWords = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (hasArabicScript) return latinWords.length > 2 ? "mixed" : "ur";
  const romanHits = latinWords.filter((w) => ROMAN_URDU.has(w) && w !== "please").length;
  return romanHits >= 2 ? "mixed" : "en";
}

/** Text direction for rendering customer content. */
export function textDirection(text: string): "rtl" | "ltr" {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return arabic > latin ? "rtl" : "ltr";
}
