"use client";

import { Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FieldShell, TextField, TextareaField, fieldA11y } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { COPY, fill } from "@/lib/intake/copy";
import { formatPkPhone, normalizePkPhone } from "@/lib/phone";
import { Bi } from "./bi";

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

type ErrorKey = "phone" | "serviceChoice" | "message";

/** Field order for moving focus to the first problem. */
const FIELD_IDS: Record<ErrorKey, string> = {
  message: "intake-message",
  phone: "intake-phone",
  serviceChoice: "intake-service",
};

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
  // For an urgent request with no clear service, pre-select the clinic's
  // emergency option: one less decision for someone in pain.
  const emergencyService = services.find((s) => /emergency|pain/i.test(s));
  const startService = initial.serviceNeeded || (emergency && emergencyService) || "";
  const knownService = services.includes(startService);
  const [serviceChoice, setServiceChoice] = useState(
    knownService ? startService : startService ? OTHER : "",
  );
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});

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
    const next: Partial<Record<ErrorKey, string>> = {};
    if (mode === "manual" && values.message.length < 2) {
      next.message = "Tell the clinic briefly what you need. / مختصراً بتائیں آپ کو کیا چاہیے۔";
    }
    if (!normalizePkPhone(values.phone)) {
      next.phone = "Enter a Pakistani mobile number, e.g. 0300 1234567. / درست موبائل نمبر لکھیں۔";
    }
    if (values.serviceNeeded.length < 2) {
      next.serviceChoice = "Choose what you need help with. / بتائیں آپ کو کیا چاہیے۔";
    }
    setErrors(next);
    const firstError = (Object.keys(FIELD_IDS) as ErrorKey[]).find((k) => next[k]);
    if (firstError) {
      // Focus by id (the field exists whether or not it's marked invalid yet).
      document.getElementById(FIELD_IDS[firstError])?.focus();
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
          <p className="text-urgency-emergency font-semibold">
            This sounds urgent. <span lang="ur">یہ فوری معاملہ لگتا ہے۔</span>
          </p>
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
          label={<Bi t={COPY.labelMessage} />}
          dir="auto"
          rows={3}
          defaultValue={initial.message}
          error={errors.message}
          maxLength={2000}
        />
      )}

      <TextField
        id="intake-name"
        name="customerName"
        label={<Bi t={COPY.labelName} />}
        autoComplete="name"
        dir="auto"
        defaultValue={initial.customerName}
        maxLength={80}
      />
      <TextField
        id="intake-phone"
        name="phone"
        label={<Bi t={COPY.labelPhone} />}
        hint="The clinic will contact you on this number."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={initial.phone}
        error={errors.phone}
        required
      />

      <FieldShell
        id="intake-service"
        label={<Bi t={COPY.labelService} />}
        error={errors.serviceChoice}
      >
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
          defaultValue={knownService ? "" : startService}
          maxLength={80}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="intake-date"
          name="preferredDate"
          label={<Bi t={COPY.labelDay} layout="stack" />}
          type="date"
          min={minDate}
          defaultValue={initial.preferredDate}
        />
        <TextField
          id="intake-time"
          name="preferredTime"
          label={<Bi t={COPY.labelTime} layout="stack" />}
          type="time"
          defaultValue={initial.preferredTime}
        />
      </div>

      {mode === "review" && (
        <TextareaField
          id="intake-notes"
          name="notes"
          label={<Bi t={COPY.labelNotes} />}
          dir="auto"
          rows={3}
          defaultValue={initial.notes}
          maxLength={2000}
        />
      )}

      {/* Consent stated plainly right before the action; sending is the agreement. */}
      <p className="text-muted-foreground text-sm">
        {fill(COPY.consent.en, clinicName)}
        <span lang="ur" dir="rtl" className="font-urdu mt-1 block">
          {COPY.consent.ur}
        </span>
      </p>

      <SubmitButton
        pending={pending}
        pendingLabel="Sending…"
        size="lg"
        className="h-auto w-full py-2"
      >
        <Send aria-hidden="true" />{" "}
        <Bi
          t={COPY.send}
          layout="stack"
          className="items-center"
          urClassName="text-base font-normal"
        />
      </SubmitButton>
    </form>
  );
}
