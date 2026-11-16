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
  sessionDays: 7,
} as const;
