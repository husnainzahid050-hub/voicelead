"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteLeadAction } from "@/app/dashboard/leads/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";

/** Owner-only, two-step delete. The server re-checks the role and the confirmation. */
export function DeleteLead({
  leadId,
  referenceNumber,
}: {
  leadId: string;
  referenceNumber: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const { state, pending, onSubmit } = useFormAction(deleteLeadAction);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" /> Delete lead
      </Button>
    );
  }
  return (
    <form
      onSubmit={onSubmit}
      className="border-destructive/30 bg-urgency-emergency-bg space-y-3 rounded-md border p-4"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="confirm" value="delete" />
      <FormMessage state={state} />
      <p className="text-sm">
        Delete <strong className="font-mono">{referenceNumber}</strong>? The patient&rsquo;s name,
        number and messages are erased permanently. The activity log keeps only the reference
        number.
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending} pendingLabel="Deleting…" variant="destructive">
          Yes, delete permanently
        </SubmitButton>
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
