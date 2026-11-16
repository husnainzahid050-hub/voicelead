/**
 * Single source of truth for every constrained value in VoiceLead.
 * The database stores these as plain strings (portable across SQLite/Postgres);
 * Zod schemas in ./validation.ts and all UI pickers derive from these arrays.
 */

export const LEAD_STATUSES = [
  "new",
  "needs_review",
  "ready_to_contact",
  "contacted",
  "booked",
  "lost",
] as const;

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: "New",
  needs_review: "Needs review",
  ready_to_contact: "Ready to contact",
  contacted: "Contacted",
  booked: "Appointment booked",
  lost: "Lost",
};

export const URGENCIES = ["low", "normal", "high", "emergency"] as const;

export const URGENCY_LABELS: Record<(typeof URGENCIES)[number], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  emergency: "Emergency",
};

/** Higher number = more urgent. Used for dashboard sorting. */
export const URGENCY_RANK: Record<(typeof URGENCIES)[number], number> = {
  low: 0,
  normal: 1,
  high: 2,
  emergency: 3,
};

export const LANGUAGES = ["ur", "en", "mixed"] as const;

export const USER_ROLES = ["owner", "staff"] as const;

export const BUSINESS_TYPES = ["dental"] as const;

export const FOLLOW_UP_TONES = ["friendly", "formal", "concise"] as const;

export const FIELD_SOURCES = ["ai", "customer", "staff"] as const;

export const TURN_ROLES = ["customer", "assistant"] as const;

/** Fields the AI extracts and the owner can edit, in clarifying-question priority order. */
export const LEAD_FIELD_NAMES = [
  "customer_name",
  "phone",
  "service_needed",
  "preferred_date",
  "preferred_time",
  "urgency",
  "notes",
] as const;

export const AUDIT_ACTIONS = [
  "lead.created",
  "lead.viewed",
  "lead.edited",
  "lead.status_changed",
  "lead.deleted",
  "lead.deletion_requested",
  "followup.generated",
  "followup.copied",
  "business.updated",
  "auth.signed_in",
  "auth.signed_out",
] as const;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Business timezone for resolving relative dates ("kal", "tomorrow"). */
export const DEFAULT_TIMEZONE = "Asia/Karachi";

export const LIMITS = {
  maxAudioSeconds: 180,
  minAudioSeconds: 1,
  maxAudioBytes: 5 * 1024 * 1024,
  maxTranscriptChars: 4000,
  maxAnswerChars: 500,
  maxFollowUpChars: 500,
  maxInternalNotesChars: 2000,
  deletionWindowHours: 24,
  /** Sliding idle lifetime: a session unused for this long expires. */
  sessionDays: 7,
  /** Absolute lifetime: re-login required after this, however active. */
  sessionAbsoluteDays: 30,
  passwordMinChars: 12,
  passwordMaxChars: 128,
} as const;

/** Auth abuse limits (per window). Keys are HMAC-hashed, never raw emails/IPs. */
export const AUTH_RATE_LIMITS = {
  signInPerEmail: { limit: 5, windowMs: 15 * 60_000 },
  signInPerIp: { limit: 20, windowMs: 15 * 60_000 },
  signUpPerIp: { limit: 5, windowMs: 60 * 60_000 },
} as const;

/** Public intake endpoints (anonymous): per hashed IP, plus a per-clinic daily cap. */
export const INTAKE_RATE_LIMITS = {
  transcribePerIp: { limit: 15, windowMs: 10 * 60_000 },
  analyzePerIp: { limit: 40, windowMs: 10 * 60_000 },
  submitPerIp: { limit: 5, windowMs: 60 * 60_000 },
  submitPerBusinessPerDay: 300,
  deletePerIp: { limit: 10, windowMs: 60 * 60_000 },
} as const;

/** Signed-in dashboard actions, per user. */
export const DASHBOARD_RATE_LIMITS = {
  mutationsPerUser: { limit: 120, windowMs: 10 * 60_000 },
  followUpAiPerUser: { limit: 30, windowMs: 10 * 60_000 },
} as const;

/** How long an intake page stays valid before it must be reloaded. */
export const INTAKE_TOKEN_TTL_SECONDS = 60 * 60;

/** Pre-ticked during onboarding so most dental clinics can just press Next. */
export const DENTAL_DEFAULT_SERVICES = [
  "Dental checkup",
  "Cleaning",
  "Filling",
  "Root canal",
  "Braces consultation",
  "Emergency dental pain",
] as const;

export const FOLLOW_UP_TONE_LABELS: Record<(typeof FOLLOW_UP_TONES)[number], string> = {
  friendly: "Friendly and warm",
  formal: "Formal and professional",
  concise: "Short and to the point",
};

export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
