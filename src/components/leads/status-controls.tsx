"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { changeStatusAction } from "@/app/dashboard/leads/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/constants";
import { primaryNextStatus } from "@/lib/leads/workflow";
import type { LeadStatus } from "@/types/domain";

export function StatusControls({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const primary = primaryNextStatus(status);
  const main = useFormAction(changeStatusAction);
  const other = useFormAction(changeStatusAction);
  const [choice, setChoice] = useState<LeadStatus | "">("");
  // When the status changes, clear the dropdown: the old choice is no longer an
  // option, and a stale value could re-apply a status nobody picked.
  const [seenStatus, setSeenStatus] = useState(status);
  if (status !== seenStatus) {
    setSeenStatus(status);
    setChoice("");
  }
  const state = other.state.status !== "idle" ? other.state : main.state;

  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {primary && (
          <form onSubmit={main.onSubmit}>
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="to" value={primary.to} />
            <SubmitButton
              pending={main.pending}
              pendingLabel="Updating…"
              className="w-full sm:w-auto"
            >
              {primary.label} <ArrowRight aria-hidden="true" />
            </SubmitButton>
          </form>
        )}
        <form onSubmit={other.onSubmit} className="flex gap-2">
          <input type="hidden" name="leadId" value={leadId} />
          <select
            name="to"
            value={choice}
            onChange={(e) => setChoice(e.target.value as LeadStatus)}
            aria-label="Change status to"
            className="border-border-strong bg-background min-h-11 min-w-0 flex-1 rounded-md border px-3 text-base"
          >
            <option value="" disabled>
              Change status…
            </option>
            {LEAD_STATUSES.filter((s) => s !== status).map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <SubmitButton
            pending={other.pending}
            pendingLabel="Saving…"
            variant="secondary"
            disabled={!choice}
          >
            Update
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
