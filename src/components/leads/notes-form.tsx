"use client";

import { saveNotesAction } from "@/app/dashboard/leads/actions";
import { TextareaField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { LIMITS } from "@/lib/constants";

export function NotesForm({ leadId, initial }: { leadId: string; initial: string | null }) {
  const { state, pending, onSubmit } = useFormAction(saveNotesAction);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <FormMessage state={state} />
      <TextareaField
        id="lead-internal-notes"
        name="internalNotes"
        label="Internal notes"
        hint="Only your team sees these. Never shared with the patient."
        defaultValue={initial ?? ""}
        error={state.fieldErrors?.internalNotes}
        rows={3}
        maxLength={LIMITS.maxInternalNotesChars}
        dir="auto"
      />
      <SubmitButton pending={pending} pendingLabel="Saving…" variant="secondary">
        Save notes
      </SubmitButton>
    </form>
  );
}
