"use client";

import { Save } from "lucide-react";
import type { ReactNode } from "react";
import { updateLeadFieldsAction } from "@/app/dashboard/leads/actions";
import { FieldShell, TextField, TextareaField, fieldA11y } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { URGENCIES, URGENCY_LABELS } from "@/lib/constants";
import type { LeadFieldName } from "@/types/domain";
import type { LeadDetailDTO } from "@/server/services/leads";

/** Where a value came from, so staff know what to double-check. */
function Provenance({ field }: { field: LeadDetailDTO["fields"][LeadFieldName] }): ReactNode {
  if (!field || field.value === null) return null;
  if (field.editedByUser || field.source === "staff") return "Edited by your team";
  if (field.source === "customer") return "Given by the patient";
  // Only flag what is actually uncertain; a warning on every field means nothing.
  if (field.confidence !== null && field.confidence >= CHECK_BELOW) return null;
  return (
    <span className="text-urgency-high font-medium">
      ⚠ Check this against the patient&rsquo;s words
    </span>
  );
}

/** AI values below this confidence get a "check this" hint. */
const CHECK_BELOW = 0.8;

export function LeadFieldsForm({ lead, services }: { lead: LeadDetailDTO; services: string[] }) {
  const { state, pending, onSubmit } = useFormAction(updateLeadFieldsAction);
  const e = state.fieldErrors;
  const p = (name: LeadFieldName) => <Provenance field={lead.fields[name]} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="leadId" value={lead.id} />
      <FormMessage state={state} />
      <TextField
        id="lead-name"
        name="customerName"
        label="Patient name"
        dir="auto"
        defaultValue={lead.customerName ?? ""}
        hint={p("customer_name")}
        error={e?.customerName}
        maxLength={80}
      />
      <TextField
        id="lead-phone"
        name="phone"
        label="Phone / WhatsApp"
        type="tel"
        defaultValue={lead.phoneDisplay ?? ""}
        hint={p("phone")}
        error={e?.phone}
        required
      />
      <TextField
        id="lead-service"
        name="serviceNeeded"
        label="Service needed"
        list="lead-service-options"
        defaultValue={lead.serviceNeeded ?? ""}
        hint={p("service_needed")}
        error={e?.serviceNeeded}
        maxLength={80}
        required
      />
      <datalist id="lead-service-options">
        {services.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <FieldShell id="lead-urgency" label="Urgency" hint={p("urgency")} error={e?.urgency}>
        <select
          name="urgency"
          defaultValue={lead.urgency}
          className="border-border-strong bg-background min-h-11 w-full rounded-md border px-3 text-base"
          {...fieldA11y("lead-urgency", p("urgency") ? true : undefined, e?.urgency)}
        >
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {URGENCY_LABELS[u]}
            </option>
          ))}
        </select>
      </FieldShell>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="lead-date"
          name="preferredDate"
          label="Preferred day"
          type="date"
          defaultValue={lead.preferredDate ?? ""}
          hint={
            lead.preferredDateText
              ? `Patient said “${lead.preferredDateText}”`
              : p("preferred_date")
          }
          error={e?.preferredDate}
        />
        <TextField
          id="lead-time"
          name="preferredTime"
          label="Preferred time"
          type="time"
          defaultValue={lead.preferredTime ?? ""}
          hint={p("preferred_time")}
          error={e?.preferredTime}
        />
      </div>
      <TextareaField
        id="lead-notes"
        name="notes"
        label="Details from the patient"
        dir="auto"
        rows={3}
        defaultValue={lead.notes ?? ""}
        hint={p("notes")}
        error={e?.notes}
      />
      <TextareaField
        id="lead-summary"
        name="summary"
        label="Summary"
        rows={2}
        defaultValue={lead.summary ?? ""}
        error={e?.summary}
        maxLength={500}
      />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        <Save aria-hidden="true" /> Save details
      </SubmitButton>
    </form>
  );
}
