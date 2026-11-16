"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import {
  BasicsFields,
  HoursFields,
  ONBOARDING_DEFAULTS,
  PatientExperienceFields,
  ServicesFields,
} from "@/components/forms/business-fields";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { completeOnboardingAction } from "./actions";

const STEPS = [
  { title: "Clinic basics", description: "How patients will recognise and reach you." },
  { title: "Services and hours", description: "We've pre-filled common dental services." },
  { title: "Patient experience", description: "What patients see, and how replies sound." },
] as const;

/** Which step each server-validated field lives on, to jump back on error. */
const FIELD_STEP: Record<string, number> = {
  name: 0,
  phone: 0,
  address: 0,
  services: 1,
  workingHours: 1,
  intakeInstructions: 2,
  commonQuestions: 2,
  followUpTone: 2,
};

export function OnboardingForm({ firstName }: { firstName: string }) {
  const [step, setStep] = useState(0);
  const stepRefs = useRef<Array<HTMLFieldSetElement | null>>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /** Native checks for one step; focuses and explains the first problem. */
  function stepIsValid(index: number): boolean {
    const fieldset = stepRefs.current[index];
    if (!fieldset) return true;
    const controls = fieldset.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    );
    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    }
    return true;
  }

  function goTo(index: number) {
    setStep(index);
    // Move focus to the new step's heading so keyboard and screen-reader users follow along.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  const { state, pending, onSubmit } = useFormAction(completeOnboardingAction, () => {
    // Enter in a field before the last step means "Next", not "submit everything".
    if (step < STEPS.length - 1) {
      if (stepIsValid(step)) goTo(step + 1);
      return false;
    }
    for (let i = 0; i < STEPS.length; i++) {
      if (!stepIsValid(i)) {
        if (i !== step) goTo(i);
        return false;
      }
    }
    return true;
  });

  // When the server reports errors, show the earliest step that has one
  // (state-adjust-during-render pattern; no effect needed).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    const steps = Object.keys(state.fieldErrors ?? {}).map((k) => FIELD_STEP[k] ?? 0);
    if (steps.length > 0) setStep(Math.min(...steps));
  }

  const errors = state.fieldErrors;
  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-sm font-semibold">Welcome, {firstName}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Set up your clinic</h1>
        <p className="text-muted-foreground mt-1">
          Takes about two minutes. You can change everything later in Settings.
        </p>
      </div>

      <ol aria-label="Setup progress" className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? "step" : undefined}>
            <div
              className={
                i <= step ? "bg-primary h-1.5 rounded-full" : "bg-border h-1.5 rounded-full"
              }
            />
            <p
              className={
                i === step ? "mt-2 text-sm font-medium" : "text-muted-foreground mt-2 text-sm"
              }
            >
              <span className="sr-only">
                Step {i + 1} of {STEPS.length}:{" "}
              </span>
              {s.title}
            </p>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
                {current.title}
              </h2>
              <p className="text-muted-foreground text-sm">{current.description}</p>
            </div>

            <FormMessage state={state} />

            {/* All steps stay mounted (hidden) so every value is submitted together. */}
            <fieldset
              ref={(el) => {
                stepRefs.current[0] = el;
              }}
              hidden={step !== 0}
              className="space-y-5"
            >
              <legend className="sr-only">{STEPS[0].title}</legend>
              <BasicsFields defaults={ONBOARDING_DEFAULTS} errors={errors} idPrefix="onb-" />
            </fieldset>
            <fieldset
              ref={(el) => {
                stepRefs.current[1] = el;
              }}
              hidden={step !== 1}
              className="space-y-6"
            >
              <legend className="sr-only">{STEPS[1].title}</legend>
              <ServicesFields defaults={ONBOARDING_DEFAULTS} errors={errors} idPrefix="onb-" />
              <HoursFields defaults={ONBOARDING_DEFAULTS} errors={errors} idPrefix="onb-" />
            </fieldset>
            <fieldset
              ref={(el) => {
                stepRefs.current[2] = el;
              }}
              hidden={step !== 2}
              className="space-y-5"
            >
              <legend className="sr-only">{STEPS[2].title}</legend>
              <PatientExperienceFields
                defaults={ONBOARDING_DEFAULTS}
                errors={errors}
                idPrefix="onb-"
              />
            </fieldset>

            <div className="border-border flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
              {step > 0 ? (
                <Button type="button" variant="secondary" onClick={() => goTo(step - 1)}>
                  <ArrowLeft aria-hidden="true" /> Back
                </Button>
              ) : (
                <span aria-hidden="true" />
              )}
              {isLast ? (
                <SubmitButton pending={pending} pendingLabel="Setting up…">
                  Finish setup
                </SubmitButton>
              ) : (
                <Button type="button" onClick={() => stepIsValid(step) && goTo(step + 1)}>
                  Next <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
