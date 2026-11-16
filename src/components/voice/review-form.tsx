"use client";

import { Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FieldShell, TextField, TextareaField, fieldA11y } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { formatPkPhone, normalizePkPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export interface ReviewValues {
  customerName: string;
  phone: string;
  serviceNeeded: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
  /** Short-form only: the customer's own description. */
  message: string;
}

const OTHER = "__other__";

export function initialReviewValues(lead?: {
  customerName: string | null;
  phone: string | null;
  serviceNeeded: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  notes: string | null;
}): ReviewValues {
  return {
    customerName: lead?.customerName ?? "",
    phone: lead?.phone ? formatPkPhone(lead.phone) : "",
    serviceNeeded: lead?.serviceNeeded ?? "",
    preferredDate: lead?.preferredDate ?? "",
    preferredTime: lead?.preferredTime ?? "",
    notes: lead?.notes ?? "",
    message: "",
  };
}

/**
 * Final check before anything is sent. Every value is editable: the
 * customer, not the AI, confirms what the clinic receives.
 */
export function ReviewForm({
  mode,
  initial,
  services,
  clinicName,
  clinicPhone,
  minDate,
  emergency,
  pending,
  onSubmit,
}: {
  mode: "review" | "manual";
  initial: ReviewValues;
  services: string[];
  clinicName: string;
  clinicPhone: string;
  minDate: string;
  emergency: boolean;
  pending: boolean;
  onSubmit: (values: ReviewValues) => void;
}) {
  const knownService = services.includes(initial.serviceNeeded);
  const [serviceChoice, setServiceChoice] = useState(
    knownService ? initial.serviceNeeded : initial.serviceNeeded ? OTHER : "",
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof ReviewValues | "consent" | "serviceChoice", string>>
  >({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const values: ReviewValues = {
      customerName: get("customerName"),
      phone: get("phone"),
      serviceNeeded: serviceChoice === OTHER ? get("serviceOther") : serviceChoice,
      preferredDate: get("preferredDate"),
      preferredTime: get("preferredTime"),
      notes: get("notes"),
      message: get("message"),
    };
    // Same rules the server enforces, checked early for a faster fix.
    const next: typeof errors = {};
    if (!normalizePkPhone(values.phone))
      next.phone = "Enter a Pakistani mobile number, e.g. 0300 1234567.";
    if (values.serviceNeeded.length < 2) next.serviceChoice = "Choose what you need help with.";
    if (mode === "manual" && values.message.length < 2)
      next.message = "Tell the clinic briefly what you need.";
    if (fd.get("consent") !== "on")
      next.consent = `Please agree to share these details with ${clinicName}.`;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = event.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]");
      first?.focus();
      return;
    }
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {emergency && (
        <div
          role="note"
          className="border-urgency-emergency/30 bg-urgency-emergency-bg rounded-lg border p-4"
        >
          <p className="text-urgency-emergency font-semibold">This sounds urgent.</p>
          <p className="text-urgency-emergency mt-1 text-sm">
            Send your request below, and if you are in severe pain or bleeding, please also call the
            clinic now.
          </p>
          <a
            href={`tel:${clinicPhone}`}
            className="bg-destructive mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-semibold text-white"
          >
            <Phone aria-hidden="true" className="size-5" /> Call {formatPkPhone(clinicPhone)}
          </a>
        </div>
      )}

      {mode === "manual" && (
        <TextareaField
          id="intake-message"
          name="message"
          label="What do you need help with?"
          dir="auto"
          rows={3}
          defaultValue={initial.message}
          error={errors.message}
          maxLength={2000}
          aria-invalid={errors.message ? true : undefined}
        />
      )}

      <TextField
        id="intake-name"
        name="customerName"
        label="Your name"
        autoComplete="name"
        dir="auto"
        defaultValue={initial.customerName}
        maxLength={80}
      />
      <TextField
        id="intake-phone"
        name="phone"
        label="WhatsApp / phone number"
        hint="The clinic will contact you on this number."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={initial.phone}
        error={errors.phone}
        required
      />

      <FieldShell id="intake-service" label="What do you need?" error={errors.serviceChoice}>
        <select
          name="serviceChoice"
          value={serviceChoice}
          onChange={(e) => setServiceChoice(e.target.value)}
          className="border-border-strong bg-background min-h-11 w-full rounded-md border px-3 text-base"
          {...fieldA11y("intake-service", undefined, errors.serviceChoice)}
        >
          <option value="" disabled>
            Choose one…
          </option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={OTHER}>Something else</option>
        </select>
      </FieldShell>
      {serviceChoice === OTHER && (
        <TextField
          id="intake-service-other"
          name="serviceOther"
          label="Describe it briefly"
          dir="auto"
          defaultValue={knownService ? "" : initial.serviceNeeded}
          maxLength={80}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="intake-date"
          name="preferredDate"
          label="Preferred day"
          type="date"
          min={minDate}
          defaultValue={initial.preferredDate}
        />
        <TextField
          id="intake-time"
          name="preferredTime"
          label="Preferred time"
          type="time"
          defaultValue={initial.preferredTime}
        />
      </div>

      {mode === "review" && (
        <TextareaField
          id="intake-notes"
          name="notes"
          label="Anything else the clinic should know?"
          dir="auto"
          rows={3}
          defaultValue={initial.notes}
          maxLength={2000}
        />
      )}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-md border p-3",
          errors.consent ? "border-destructive" : "border-border",
        )}
      >
        <input
          type="checkbox"
          name="consent"
          className="accent-primary mt-1 size-5"
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? "intake-consent-error" : undefined}
        />
        <span className="text-sm">
          I agree to share these details with <strong>{clinicName}</strong> so they can contact me
          about this request.
        </span>
      </label>
      {errors.consent && (
        <p id="intake-consent-error" className="text-destructive -mt-3 text-sm font-medium">
          {errors.consent}
        </p>
      )}

      <SubmitButton pending={pending} pendingLabel="Sending…" size="lg" className="w-full">
        <Send aria-hidden="true" /> Send to clinic
      </SubmitButton>
    </form>
  );
}
