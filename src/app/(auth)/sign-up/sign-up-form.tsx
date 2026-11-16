"use client";

import Link from "next/link";
import { TextField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { PasswordField } from "@/components/forms/password-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { Card, CardContent } from "@/components/ui/card";
import { LIMITS } from "@/lib/constants";
import { signUpAction } from "../actions";

export function SignUpForm() {
  const { state, pending, onSubmit } = useFormAction(signUpAction);
  const errors = state.fieldErrors;

  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create your clinic account</h1>
          <p className="text-muted-foreground mt-1">
            Free to set up. You&rsquo;ll add your clinic details next.
          </p>
        </div>

        <FormMessage state={state} />

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <TextField
            id="signup-name"
            name="name"
            label="Your name"
            autoComplete="name"
            required
            maxLength={80}
            error={errors?.name}
          />
          <TextField
            id="signup-email"
            name="email"
            type="email"
            label="Work email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            required
            error={errors?.email}
          />
          <PasswordField
            id="signup-password"
            name="password"
            label="Password"
            hint={`At least ${LIMITS.passwordMinChars} characters. A short phrase is easy to remember.`}
            autoComplete="new-password"
            required
            minLength={LIMITS.passwordMinChars}
            maxLength={LIMITS.passwordMaxChars}
            error={errors?.password}
          />
          <SubmitButton pending={pending} pendingLabel="Creating account…" className="w-full">
            Create account
          </SubmitButton>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
