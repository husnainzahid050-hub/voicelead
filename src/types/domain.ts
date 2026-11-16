import type {
  AUDIT_ACTIONS,
  BUSINESS_TYPES,
  FIELD_SOURCES,
  FOLLOW_UP_TONES,
  LANGUAGES,
  LEAD_FIELD_NAMES,
  LEAD_STATUSES,
  TURN_ROLES,
  URGENCIES,
  USER_ROLES,
  WEEKDAYS,
} from "@/lib/constants";

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type Urgency = (typeof URGENCIES)[number];
export type Language = (typeof LANGUAGES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type FollowUpTone = (typeof FOLLOW_UP_TONES)[number];
export type FieldSource = (typeof FIELD_SOURCES)[number];
export type TurnRole = (typeof TURN_ROLES)[number];
export type LeadFieldName = (typeof LEAD_FIELD_NAMES)[number];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type Weekday = (typeof WEEKDAYS)[number];
