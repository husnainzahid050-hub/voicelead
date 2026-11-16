import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/skeleton";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth/guards";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<CardSkeleton lines={3} label="Loading sign-in form" />}>
      <SignInGate searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInGate({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  // Already signed in with a live session: skip the form.
  const user = await getCurrentUser();
  if (user) redirect(user.businessId ? "/dashboard" : "/onboarding");

  const params = await searchParams;
  const next = safeNextPath(params.next);
  const expired = params.reason === "expired";
  const demo =
    env.SHOW_DEMO_LOGIN && env.DEMO_OWNER_PASSWORD ? { password: env.DEMO_OWNER_PASSWORD } : null;

  return <SignInForm next={next} expired={expired} demo={demo} />;
}
