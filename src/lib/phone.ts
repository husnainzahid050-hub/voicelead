/**
 * Pakistani phone number handling.
 *
 * Everything is stored as E.164 (+92XXXXXXXXXX). Accepted inputs include
 * 03001234567, 0300-1234567, 0300 1234567, +92 300 1234567, 0092300..., 92300...
 * and landlines such as 05822-123456 (Muzaffarabad).
 */

export type PhoneKind = "mobile" | "landline";

export interface NormalizedPhone {
  e164: string;
  kind: PhoneKind;
}

/** Mobile national numbers: 3XX followed by 7 digits (10 digits total). */
const MOBILE_NSN = /^3\d{9}$/;
/** Landline national numbers: area code (not starting with 0, 1 or 3) + subscriber, 9-10 digits. */
const LANDLINE_NSN = /^[2456789]\d{8,9}$/;

export function normalizePkPhone(input: string): NormalizedPhone | null {
  if (typeof input !== "string" || input.length > 32) return null;

  // Allow only digits, spaces, dashes, dots, parentheses and one leading plus.
  if (!/^\+?[\d\s\-.()]+$/.test(input.trim())) return null;

  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length >= 11) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (MOBILE_NSN.test(digits)) return { e164: `+92${digits}`, kind: "mobile" };
  if (LANDLINE_NSN.test(digits)) return { e164: `+92${digits}`, kind: "landline" };
  return null;
}

/** For list views: "+92 300 ***4567". Never reveals more than the last 4 digits. */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const nsn = e164.replace(/^\+92/, "").replace(/\D/g, "");
  if (nsn.length < 7) return "***";
  return `+92 ${nsn.slice(0, 3)} ***${nsn.slice(-4)}`;
}

/** Local display format: mobile "0300 1234567", landline "05822 123456". */
export function formatPkPhone(e164: string): string {
  const nsn = e164.replace(/^\+92/, "");
  if (MOBILE_NSN.test(nsn)) return `0${nsn.slice(0, 3)} ${nsn.slice(3)}`;
  // Landline area codes vary in length; keep it simple and readable.
  return `0${nsn}`;
}

/** Digits-only form used by wa.me deep links: "923001234567". */
export function toWhatsAppDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
