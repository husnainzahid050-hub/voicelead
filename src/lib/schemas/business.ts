import { z } from "zod";
import { FOLLOW_UP_TONES, WEEKDAYS } from "../constants";
import { pkPhoneSchema, slugSchema, workingHoursSchema } from "../validation";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

const textList = (maxItems: number, maxChars: number) =>
  z
    .array(z.string().trim().min(1).max(maxChars, `Keep each item under ${maxChars} characters`))
    .max(maxItems, `Add at most ${maxItems} items`);

/** Everything collected during onboarding. Field names match form input names. */
export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your clinic's name").max(80, "Name is too long"),
  phone: pkPhoneSchema,
  address: optionalText(200, "Address is too long"),
  services: textList(20, 60).min(1, "Choose at least one service"),
  workingHours: workingHoursSchema.min(1, "Open at least one day"),
  intakeInstructions: optionalText(500, "Keep instructions under 500 characters"),
  commonQuestions: textList(10, 150),
  followUpTone: z.enum(FOLLOW_UP_TONES, "Choose a message tone"),
});

/** Settings adds fields that only make sense once the clinic exists. */
export const businessSettingsSchema = businessProfileSchema.extend({
  slug: slugSchema,
  description: optionalText(300, "Keep the description under 300 characters"),
  email: z
    .string()
    .trim()
    .max(254)
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .pipe(z.email("Enter a valid email").nullable()),
  isActive: z.boolean(),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;

const str = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

const lines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Turn raw FormData into the plain object the schemas expect. This only
 * reshapes; all validation stays in Zod. Unknown keys are ignored.
 *
 * Form conventions:
 *   services        repeated checkbox values, plus `servicesOther` (one per line)
 *   hours.<day>.on  "on" when open; hours.<day>.open / .close as HH:mm
 *   commonQuestions textarea, one per line
 */
export function readBusinessForm(fd: FormData) {
  const checked = fd.getAll("services").filter((v): v is string => typeof v === "string");
  const services = [...new Set([...checked, ...lines(str(fd, "servicesOther"))])];

  const workingHours = WEEKDAYS.filter((day) => fd.get(`hours.${day}.on`) === "on").map((day) => ({
    day,
    open: str(fd, `hours.${day}.open`),
    close: str(fd, `hours.${day}.close`),
  }));

  return {
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    services,
    workingHours,
    intakeInstructions: str(fd, "intakeInstructions"),
    commonQuestions: lines(str(fd, "commonQuestions")),
    followUpTone: str(fd, "followUpTone"),
    // Settings-only fields (ignored by the onboarding schema):
    slug: str(fd, "slug").trim().toLowerCase(),
    description: str(fd, "description"),
    email: str(fd, "email"),
    isActive: fd.get("isActive") === "on",
  };
}
