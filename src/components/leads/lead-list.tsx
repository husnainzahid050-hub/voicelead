import { ChevronRight, Copy, Inbox } from "lucide-react";
import Link from "next/link";
import { StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { formatPreferred, timeAgo } from "@/lib/format";
import { isoDateInTimezone } from "@/lib/dates";
import { isOpen, nextAction } from "@/lib/leads/workflow";
import { cn } from "@/lib/utils";
import type { LeadListItemDTO } from "@/server/services/leads";

const TONE: Record<ReturnType<typeof nextAction>["tone"], string> = {
  urgent: "text-urgency-emergency font-semibold",
  action: "text-status-new font-medium",
  waiting: "text-muted-foreground",
  done: "text-muted-foreground",
};

export function LeadList({
  leads,
  emptyMessage,
}: {
  leads: LeadListItemDTO[];
  emptyMessage: string;
}) {
  if (leads.length === 0) {
    return (
      <div className="border-border-strong bg-background flex flex-col items-center rounded-lg border border-dashed px-4 py-12 text-center">
        <Inbox aria-hidden="true" className="text-muted-foreground size-10" />
        <p className="mt-3 font-medium">{emptyMessage}</p>
      </div>
    );
  }
  const now = new Date();
  const todayIso = isoDateInTimezone(now);
  return (
    <ul className="divide-border border-border bg-background divide-y overflow-hidden rounded-lg border">
      {leads.map((lead) => {
        const action = nextAction(lead.status, lead.urgency);
        const preferred = formatPreferred(lead.preferredDate, lead.preferredTime);
        const open = isOpen(lead.status);
        const datePassed = open && !!lead.preferredDate && lead.preferredDate < todayIso;
        return (
          <li key={lead.id}>
            <Link
              href={`/dashboard/leads/${lead.id}`}
              className={cn(
                "hover:bg-surface flex items-center gap-3 border-l-4 p-4",
                // Urgency at a glance down the left edge, for open leads only.
                open && lead.urgency === "emergency"
                  ? "border-l-urgency-emergency"
                  : open && lead.urgency === "high"
                    ? "border-l-urgency-high"
                    : "border-l-transparent",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <UrgencyBadge urgency={lead.urgency} />
                  <StatusBadge status={lead.status} />
                  {lead.possibleDuplicate && (
                    <span className="bg-surface-strong text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      <Copy aria-hidden="true" className="size-3" /> Possible duplicate
                    </span>
                  )}
                </div>
                <p className="truncate font-semibold">
                  {/* <bdi> isolates an Urdu-script name so the row stays left-to-right. */}
                  {lead.customerName ? (
                    <bdi>{lead.customerName}</bdi>
                  ) : (
                    <span className="text-muted-foreground italic">Name not given</span>
                  )}
                  <span className="text-muted-foreground ml-2 font-normal">
                    · {lead.serviceNeeded ?? "Request"}
                  </span>
                </p>
                <p className={cn("text-sm", TONE[action.tone])}>{action.label}</p>
                <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {preferred && (
                    <span className={cn(datePassed && "text-urgency-high font-medium")}>
                      {datePassed ? `Wanted ${preferred} (passed)` : `Wants ${preferred}`}
                    </span>
                  )}
                  <span className="tabular-nums">{timeAgo(lead.createdAt, now)}</span>
                  <span className="font-mono">{lead.phoneMasked}</span>
                </p>
              </div>
              <ChevronRight aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
