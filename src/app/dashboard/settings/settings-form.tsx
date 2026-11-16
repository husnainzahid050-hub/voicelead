"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  BasicsFields,
  HoursFields,
  PatientExperienceFields,
  ServicesFields,
  type BusinessFormDefaults,
} from "@/components/forms/business-fields";
import { FieldShell, TextField, TextareaField, fieldA11y } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateSettingsAction } from "./actions";

export interface SettingsInitial extends BusinessFormDefaults {
  slug: string;
  description: string;
  email: string;
  isActive: boolean;
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const { state, pending, onSubmit } = useFormAction(updateSettingsAction);
  const errors = state.fieldErrors;
  const [slug, setSlug] = useState(initial.slug);
  const slugChanged = slug.trim().toLowerCase() !== initial.slug;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Clinic details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <BasicsFields defaults={initial} errors={errors} idPrefix="set-" />
          <TextField
            id="set-email"
            name="email"
            type="email"
            label="Clinic email"
            hint="Optional. Not shown to patients."
            defaultValue={initial.email}
            error={errors?.email}
            autoComplete="email"
          />
          <TextareaField
            id="set-description"
            name="description"
            label="Short description"
            hint="Optional. One or two sentences shown on your intake page."
            defaultValue={initial.description}
            error={errors?.description}
            maxLength={300}
            rows={2}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services and hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ServicesFields defaults={initial} errors={errors} idPrefix="set-" />
          <HoursFields defaults={initial} errors={errors} idPrefix="set-" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patient experience</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientExperienceFields defaults={initial} errors={errors} idPrefix="set-" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intake page</CardTitle>
          <CardDescription>Your public link and whether it accepts new requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FieldShell
            id="set-slug"
            label="Link name"
            hint="Lowercase letters, numbers and dashes."
            error={errors?.slug}
          >
            <div className="flex items-stretch">
              <span className="border-border-strong bg-surface text-muted-foreground flex items-center rounded-l-md border border-r-0 px-3 text-sm">
                /intake/
              </span>
              <Input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="rounded-l-none font-mono"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={48}
                {...fieldA11y("set-slug", true, errors?.slug)}
              />
            </div>
          </FieldShell>
          {slugChanged && (
            <p
              role="status"
              className="bg-urgency-high-bg text-urgency-high flex items-start gap-2 rounded-md p-3 text-sm"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Changing this breaks your old link and any printed QR codes.
            </p>
          )}

          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initial.isActive}
              className="accent-primary mt-1 size-5"
            />
            <span>
              <span className="font-medium">Accept new patient requests</span>
              <span className="text-muted-foreground block text-sm">
                Turn off to pause your intake page, e.g. during holidays.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="border-border bg-background/95 sticky bottom-0 -mx-4 flex justify-end border-t px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}
