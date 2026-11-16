import type { ComponentProps } from "react";
import { LEAD_STATUS_LABELS, URGENCY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LeadStatus, Urgency } from "@/types/domain";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
      {...props}
    />
  );
}

// Class strings are written out in full so Tailwind can detect them.
const URGENCY_CLASSES: Record<Urgency, string> = {
  emergency: "bg-urgency-emergency-bg text-urgency-emergency ring-1 ring-urgency-emergency/30",
  high: "bg-urgency-high-bg text-urgency-high ring-1 ring-urgency-high/30",
  normal: "bg-urgency-normal-bg text-urgency-normal",
  low: "bg-urgency-low-bg text-urgency-low",
};

const STATUS_CLASSES: Record<LeadStatus, string> = {
  new: "bg-status-new-bg text-status-new",
  needs_review: "bg-status-review-bg text-status-review",
  ready_to_contact: "bg-status-ready-bg text-status-ready",
  contacted: "bg-status-contacted-bg text-status-contacted",
  booked: "bg-status-booked-bg text-status-booked",
  lost: "bg-status-lost-bg text-status-lost",
};

/** Color is never the only signal: the text label always carries the meaning. */
export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  return (
    <Badge className={cn(URGENCY_CLASSES[urgency], className)}>
      {urgency === "emergency" && <span aria-hidden="true">●</span>}
      {URGENCY_LABELS[urgency]}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <Badge className={cn(STATUS_CLASSES[status], className)}>{LEAD_STATUS_LABELS[status]}</Badge>
  );
}
