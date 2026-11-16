"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { TextField } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { PasswordField } from "@/components/forms/password-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { Card, CardContent } from "@/components/ui/card";
import { signInAction } from "../actions";

const DEMO_ACCOUNTS = [
  { email: "owner@smilecare.demo", role: "Clinic owner" },
  { email: "staff@smilecare.demo", role: "Receptionist (staff)" },
];

export function SignInForm({
  next,
  expired,
  demo,
}: {
  next: string | null;
  expired: boolean;
  demo: { password: string } | null;
}) {
  const { state, pending, onSubmit } = useFormAction(signInAction);
  const errors = state.fieldErrors;

  // Full page load (not client navigation) after sign-in; see signInAction.
  const redirectTo = state.status === "success" ? state.redirectTo : undefined;
  useEffect(() => {
    if (redirectTo) window.location.assign(redirectTo);
  }, [redirectTo]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sign in to your clinic</h1>
            <p className="text-muted-foreground mt-1">Review and follow up on patient requests.</p>
          </div>

          {expired && state.status === "idle" && (
            <p
              role="status"
              className="bg-status-review-bg text-status-review rounded-md p-3 text-sm"
            >
              Your session has ended. Please sign in again.
            </p>
          )}
          <FormMessage state={state} />

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {next && <input type="hidden" name="next" value={next} />}
            <TextField
              id="signin-email"
              name="email"
              type="email"
              label="Email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
              error={errors?.email}
            />
            <PasswordField
              id="signin-password"
              name="password"
              label="Password"
              autoComplete="current-password"
              required
              error={errors?.password}
            />
            <SubmitButton
              pending={pending || !!redirectTo}
              pendingLabel="Signing in…"
              className="w-full"
            >
              Sign in
            </SubmitButton>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            New to VoiceLead?{" "}
            <Link href="/sign-up" className="text-primary font-medium hover:underline">
              Create a clinic account
            </Link>
          </p>
        </CardContent>
      </Card>

      {demo && (
        <aside
          aria-labelledby="demo-heading"
          className="border-primary/20 bg-primary-soft rounded-lg border p-4 text-sm"
        >
          <h2 id="demo-heading" className="text-status-new flex items-center gap-2 font-semibold">
            <Info aria-hidden="true" className="size-4" /> Try the demo clinic
          </h2>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <code className="font-mono">{a.email}</code>{" "}
                <span className="text-muted-foreground">({a.role})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Password: <code className="font-mono">{demo.password}</code>
          </p>
        </aside>
      )}
    </div>
  );
}
