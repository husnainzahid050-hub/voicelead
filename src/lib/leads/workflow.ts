import type { LeadStatus, Urgency } from "@/types/domain";

/** Statuses that still need the clinic to do something. */
export const OPEN_STATUSES: readonly LeadStatus[] = ["new", "needs_review", "ready_to_contact"];

export function isOpen(status: LeadStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export interface NextAction {
  label: string;
  tone: "urgent" | "action" | "waiting" | "done";
}

/** Plain-language "what should I do next?" for a lead. */
export function nextAction(status: LeadStatus, urgency: Urgency): NextAction {
  if (isOpen(status) && urgency === "emergency")
    return { label: "Call now: urgent", tone: "urgent" };
  switch (status) {
    case "new":
      return { label: "Review the details", tone: "action" };
    case "needs_review":
      return { label: "Check and correct the details", tone: "action" };
    case "ready_to_contact":
      return { label: "Send the follow-up message", tone: "action" };
    case "contacted":
      return { label: "Waiting for reply: book when they confirm", tone: "waiting" };
    case "booked":
      return { label: "Appointment booked", tone: "done" };
    case "lost":
      return { label: "No action needed", tone: "done" };
  }
}

export interface TransitionInput {
  from: LeadStatus;
  to: LeadStatus;
  hasPhone: boolean;
  hasService: boolean;
}

/**
 * Status rules, enforced on the server. A lead only becomes "Ready to
 * contact" through an explicit human review, and only when it has what is
 * needed to contact the patient. Returns an error message, or null if allowed.
 */
export function transitionError({
  from,
  to,
  hasPhone,
  hasService,
}: TransitionInput): string | null {
  if (from === to) return "The lead already has this status.";
  if ((to === "ready_to_contact" || to === "contacted" || to === "booked") && !hasPhone) {
    return "Add the patient's phone number first.";
  }
  if (to === "ready_to_contact" && !hasService) return "Add what the patient needs first.";
  return null;
}

/** The single most useful next status, shown as the primary button. */
export function primaryNextStatus(status: LeadStatus): { to: LeadStatus; label: string } | null {
  switch (status) {
    case "new":
    case "needs_review":
      return { to: "ready_to_contact", label: "Mark reviewed: ready to contact" };
    case "ready_to_contact":
      return { to: "contacted", label: "Mark as contacted" };
    case "contacted":
      return { to: "booked", label: "Mark appointment booked" };
    default:
      return null;
  }
}
