"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DENTAL_DEFAULT_SERVICES,
  FOLLOW_UP_TONE_LABELS,
  FOLLOW_UP_TONES,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WorkingHours } from "@/lib/validation";
import type { FollowUpTone, Weekday } from "@/types/domain";
import { FieldError, TextField, TextareaField } from "./field";

/** Initial values for the business form (onboarding defaults or saved settings). */
export interface BusinessFormDefaults {
  name: string;
  phone: string;
  address: string;
  services: string[];
  workingHours: WorkingHours;
  intakeInstructions: string;
  commonQuestions: string[];
  followUpTone: FollowUpTone;
}

type Errors = Record<string, string> | undefined;

export const ONBOARDING_DEFAULTS: BusinessFormDefaults = {
  name: "",
  phone: "",
  address: "",
  services: [...DENTAL_DEFAULT_SERVICES],
  workingHours: (["mon", "tue", "wed", "thu", "fri", "sat"] as const).map((day) => ({
    day,
    open: "10:00",
    close: "20:00",
  })),
  intakeInstructions:
    "Tell us what problem you are having, when you would like to visit, and your WhatsApp number. You can speak in Urdu or English.",
  commonQuestions: [],
  followUpTone: "friendly",
};

export function BasicsFields({
  defaults,
  errors,
  idPrefix = "",
}: {
  defaults: BusinessFormDefaults;
  errors: Errors;
  /** Keeps ids unique when several forms exist in the DOM (Next.js keeps visited pages mounted). */
  idPrefix?: string;
}) {
  return (
    <div className="space-y-5">
      <TextField
        id={`${idPrefix}name`}
        name="name"
        label="Clinic name"
        defaultValue={defaults.name}
        error={errors?.name}
        autoComplete="organization"
        required
        maxLength={80}
      />
      <TextField
        id={`${idPrefix}phone`}
        name="phone"
        label="Clinic contact number"
        hint="Shown to patients. Mobile or landline, e.g. 0300 1234567 or 05822 123456."
        defaultValue={defaults.phone}
        error={errors?.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        maxLength={20}
      />
      <TextField
        id={`${idPrefix}address`}
        name="address"
        label="Location"
        hint="Optional. Street and city, so patients know where to come."
        defaultValue={defaults.address}
        error={errors?.address}
        autoComplete="street-address"
        maxLength={200}
      />
    </div>
  );
}

export function ServicesFields({
  defaults,
  errors,
  idPrefix = "",
}: {
  defaults: BusinessFormDefaults;
  errors: Errors;
  /** Keeps ids unique when several forms exist in the DOM (Next.js keeps visited pages mounted). */
  idPrefix?: string;
}) {
  const standard: readonly string[] = DENTAL_DEFAULT_SERVICES;
  const extras = defaults.services.filter((s) => !standard.includes(s));
  return (
    <fieldset
      className="space-y-3"
      aria-describedby={errors?.services ? `${idPrefix}services-error` : undefined}
    >
      <legend className="text-sm font-medium">Services you offer</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {DENTAL_DEFAULT_SERVICES.map((service) => (
          <label
            key={service}
            className="border-border hover:bg-surface has-checked:border-primary has-checked:bg-primary-soft flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3"
          >
            <input
              type="checkbox"
              name="services"
              value={service}
              defaultChecked={defaults.services.includes(service)}
              className="accent-primary size-5"
            />
            <span>{service}</span>
          </label>
        ))}
      </div>
      <TextareaField
        id={`${idPrefix}servicesOther`}
        name="servicesOther"
        label="Other services"
        hint="Optional. One per line, e.g. Teeth whitening."
        defaultValue={extras.join("\n")}
        className="pt-2"
        rows={2}
      />
      <FieldError id={`${idPrefix}services`} error={errors?.services} />
    </fieldset>
  );
}

export function HoursFields({
  defaults,
  errors,
  idPrefix = "",
}: {
  defaults: BusinessFormDefaults;
  errors: Errors;
  /** Keeps ids unique when several forms exist in the DOM (Next.js keeps visited pages mounted). */
  idPrefix?: string;
}) {
  const byDay = new Map(defaults.workingHours.map((h) => [h.day, h]));
  const [open, setOpen] = useState<Record<Weekday, boolean>>(
    () => Object.fromEntries(WEEKDAYS.map((d) => [d, byDay.has(d)])) as Record<Weekday, boolean>,
  );

  return (
    <fieldset
      className="space-y-3"
      aria-describedby={errors?.workingHours ? `${idPrefix}workingHours-error` : undefined}
    >
      <legend className="text-sm font-medium">Working hours</legend>
      <ul className="divide-border border-border divide-y rounded-md border">
        {WEEKDAYS.map((day) => {
          const hours = byDay.get(day);
          const isOpen = open[day];
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
              <label className="flex min-h-11 w-36 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name={`hours.${day}.on`}
                  checked={isOpen}
                  onChange={(e) => setOpen((prev) => ({ ...prev, [day]: e.target.checked }))}
                  className="accent-primary size-5"
                />
                <span className="font-medium">{WEEKDAY_LABELS[day]}</span>
              </label>
              {isOpen ? (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Input
                    type="time"
                    name={`hours.${day}.open`}
                    defaultValue={hours?.open ?? "10:00"}
                    aria-label={`${WEEKDAY_LABELS[day]} opening time`}
                    className="min-w-0 flex-1 px-2 sm:w-36 sm:flex-none"
                    required
                  />
                  <span aria-hidden="true" className="text-muted-foreground">
                    to
                  </span>
                  <Input
                    type="time"
                    name={`hours.${day}.close`}
                    defaultValue={hours?.close ?? "20:00"}
                    aria-label={`${WEEKDAY_LABELS[day]} closing time`}
                    className="min-w-0 flex-1 px-2 sm:w-36 sm:flex-none"
                    required
                  />
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
      <FieldError id={`${idPrefix}workingHours`} error={errors?.workingHours} />
    </fieldset>
  );
}

export function PatientExperienceFields({
  defaults,
  errors,
  idPrefix = "",
}: {
  defaults: BusinessFormDefaults;
  errors: Errors;
  /** Keeps ids unique when several forms exist in the DOM (Next.js keeps visited pages mounted). */
  idPrefix?: string;
}) {
  return (
    <div className="space-y-5">
      <TextareaField
        id={`${idPrefix}intakeInstructions`}
        name="intakeInstructions"
        label="Welcome message for patients"
        hint="Shown above the microphone button on your intake page."
        defaultValue={defaults.intakeInstructions}
        error={errors?.intakeInstructions}
        maxLength={500}
        rows={3}
      />
      <TextareaField
        id={`${idPrefix}commonQuestions`}
        name="commonQuestions"
        label="Questions patients often ask"
        hint="Optional. One per line, e.g. Do you treat children?"
        defaultValue={defaults.commonQuestions.join("\n")}
        error={errors?.commonQuestions}
        rows={3}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tone of follow-up messages</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {FOLLOW_UP_TONES.map((tone) => (
            <label
              key={tone}
              className={cn(
                "border-border hover:bg-surface flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2",
                "has-checked:border-primary has-checked:bg-primary-soft",
              )}
            >
              <input
                type="radio"
                name="followUpTone"
                value={tone}
                defaultChecked={defaults.followUpTone === tone}
                className="accent-primary size-5"
                required
              />
              <span>{FOLLOW_UP_TONE_LABELS[tone]}</span>
            </label>
          ))}
        </div>
        <FieldError id={`${idPrefix}followUpTone`} error={errors?.followUpTone} />
      </fieldset>
    </div>
  );
}
