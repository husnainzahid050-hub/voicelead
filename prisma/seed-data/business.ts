/**
 * Fictional demo businesses and users. No real people or clinics.
 * Phone numbers use valid Pakistani formats with obviously fake
 * subscriber digits (e.g. 0300 0000xxx).
 */
import type { WorkingHours } from "../../src/lib/validation";

export interface SeedBusiness {
  key: "smilecare" | "brightsmile";
  name: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  workingHours: WorkingHours;
  services: string[];
  intakeInstructions: string;
  commonQuestions: string[];
  followUpTone: "friendly" | "formal" | "concise";
}

export interface SeedUser {
  email: string;
  name: string;
  role: "owner" | "staff";
  businessKey: SeedBusiness["key"];
}

const monToSat = (open: string, close: string): WorkingHours =>
  (["mon", "tue", "wed", "thu", "fri", "sat"] as const).map((day) => ({ day, open, close }));

export const SEED_BUSINESSES: SeedBusiness[] = [
  {
    key: "smilecare",
    name: "SmileCare Dental Clinic",
    slug: "smilecare-dental",
    description:
      "Family dental clinic in Muzaffarabad offering checkups, cleaning, fillings, root canals and braces consultations.",
    phone: "05822-000100",
    email: "hello@smilecare.demo",
    address: "Chattar Road, Muzaffarabad, Azad Kashmir",
    workingHours: monToSat("10:00", "20:00"),
    services: [
      "Dental checkup",
      "Cleaning",
      "Filling",
      "Root canal",
      "Braces consultation",
      "Emergency dental pain",
    ],
    intakeInstructions:
      "Tell us what problem you are having, when you would like to visit, and your WhatsApp number. You can speak in Urdu or English.",
    commonQuestions: [
      "What are your clinic timings?",
      "Do you treat children?",
      "How much does a cleaning cost?",
      "Is a root canal painful?",
    ],
    followUpTone: "friendly",
  },
  {
    // Second tenant: exists so authorization tests can prove that one
    // business can never read or modify another business's leads.
    key: "brightsmile",
    name: "Bright Smile Dental",
    slug: "bright-smile-dental",
    description: "Dental clinic in Mirpur.",
    phone: "05827-000200",
    email: "contact@brightsmile.demo",
    address: "Allama Iqbal Road, Mirpur, Azad Kashmir",
    workingHours: monToSat("09:00", "17:00"),
    services: ["Dental checkup", "Cleaning", "Filling"],
    intakeInstructions: "Please describe your dental problem and share your phone number.",
    commonQuestions: [],
    followUpTone: "formal",
  },
];

export const SEED_USERS: SeedUser[] = [
  {
    email: "owner@smilecare.demo",
    name: "Dr. Nadia Rehman",
    role: "owner",
    businessKey: "smilecare",
  },
  { email: "staff@smilecare.demo", name: "Kamran Yousaf", role: "staff", businessKey: "smilecare" },
  {
    email: "owner@brightsmile.demo",
    name: "Dr. Tariq Mehmood",
    role: "owner",
    businessKey: "brightsmile",
  },
];
