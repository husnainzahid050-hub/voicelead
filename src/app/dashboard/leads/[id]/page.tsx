import { ArrowLeft, Copy, Phone, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { Confidence } from "@/components/leads/confidence";
import { ConversationPanel } from "@/components/leads/conversation-panel";
import { DeleteLead } from "@/components/leads/delete-lead";
import { FollowUpPanel } from "@/components/leads/follow-up-panel";
import { HistoryList } from "@/components/leads/history-list";
import { LeadFieldsForm } from "@/components/leads/lead-fields-form";
import { NotesForm } from "@/components/leads/notes-form";
import { StatusControls } from "@/components/leads/status-controls";
import { CardSkeleton } from "@/components/skeleton";
import { StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatPreferred } from "@/lib/format";
import { nextAction } from "@/lib/leads/workflow";
import { can } from "@/lib/permissions";
import { leadIdSchema } from "@/lib/schemas/lead";
import { cn } from "@/lib/utils";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { getLeadDetail, getLeadFormOptions, recordLeadViewed } from "@/server/services/leads";

export const metadata: Metadata = { title: "Lead" };

export default function LeadPage({ params }: PageProps<"/dashboard/leads/[id]">) {
  return (
    <>
      <Link
        href="/dashboard/leads"
        className="text-primary mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> All leads
      </Link>
      <Suspense fallback={<CardSkeleton lines={6} label="Loading lead" />}>
        <LeadDetail params={params} />
      </Suspense>
    </>
  );
}

async function LeadDetail({ params }: Pick<PageProps<"/dashboard/leads/[id]">, "params">) {
  const user = await requireBusinessUser();
  const ctx = toAuthContext(user);
  const { id } = await params;
  if (!leadIdSchema.safeParse(id).success) notFound();

  // Scoped by the session's clinic: another clinic's id is simply "not found".
  const [lead, options] = await Promise.all([getLeadDetail(ctx, id), getLeadFormOptions(ctx)]);
  if (!lead) notFound();

  // Audit "viewed" after the response is sent (does not slow the page).
  after(() => recordLeadViewed(ctx, lead.id));

  const action = nextAction(lead.status, lead.urgency);
  const preferred = formatPreferred(lead.preferredDate, lead.preferredTime);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={lead.urgency} />
          <StatusBadge status={lead.status} />
          <span className="text-muted-foreground font-mono text-sm">{lead.referenceNumber}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" dir="auto">
          {lead.customerName ?? <span className="text-muted-foreground">Name not given</span>}
        </h1>
        <p className="text-muted-foreground">
          {lead.serviceNeeded ?? "Request"}
          {preferred ? ` · wants ${preferred}` : ""} · received {formatDateTime(lead.createdAt)}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="text-primary inline-flex min-h-11 items-center gap-2 font-mono text-lg font-semibold hover:underline"
            >
              <Phone aria-hidden="true" className="size-5" /> {lead.phoneDisplay}
            </a>
          )}
          <Confidence value={lead.aiConfidence} />
        </div>
      </header>

      <Card
        className={cn(
          action.tone === "urgent" && "border-urgency-emergency/40 bg-urgency-emergency-bg",
        )}
      >
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground text-sm">Next step</p>
            <p
              className={cn(
                "text-lg font-semibold",
                action.tone === "urgent" && "text-urgency-emergency",
              )}
            >
              {action.label}
            </p>
            {lead.summary && <p className="mt-1">{lead.summary}</p>}
          </div>
          <StatusControls leadId={lead.id} status={lead.status} />
        </CardContent>
      </Card>

      {(lead.aiChecks.length > 0 || lead.duplicates.length > 0) && (
        <div className="space-y-2">
          {lead.aiChecks.map((check) => (
            <p
              key={check}
              className="bg-status-review-bg text-status-review flex items-start gap-2 rounded-md p-3 text-sm"
            >
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {check}
            </p>
          ))}
          {lead.duplicates.length > 0 && (
            <p className="bg-surface-strong flex flex-wrap items-start gap-2 rounded-md p-3 text-sm">
              <Copy aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Possible duplicate: the same number sent{" "}
                {lead.duplicates.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/dashboard/leads/${d.id}`}
                      className="text-primary font-mono font-medium hover:underline"
                    >
                      {d.referenceNumber}
                    </Link>
                  </span>
                ))}
                .
              </span>
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Follow-up message</CardTitle>
        </CardHeader>
        <CardContent>
          <FollowUpPanel
            key={lead.followUpMessage ?? "none"}
            leadId={lead.id}
            initialMessage={lead.followUpMessage}
            whatsappDigits={lead.whatsappDigits}
            status={lead.status}
          />
        </CardContent>
      </Card>

      {/* Extracted fields beside the original words, so staff can verify every value. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadFieldsForm lead={lead} services={options.services} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What the patient said</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationPanel lead={lead} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <NotesForm leadId={lead.id} initial={lead.internalNotes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryList history={lead.history} />
          </CardContent>
        </Card>
      </div>

      {can(user.role, "leads:delete") && (
        <div className="border-border border-t pt-4">
          <DeleteLead leadId={lead.id} referenceNumber={lead.referenceNumber} />
        </div>
      )}
    </div>
  );
}
