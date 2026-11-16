import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/skeleton";
import { getCurrentUser } from "@/server/auth/guards";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your clinic account" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<CardSkeleton lines={4} label="Loading sign-up form" />}>
      <SignUpGate />
    </Suspense>
  );
}

async function SignUpGate() {
  const user = await getCurrentUser();
  if (user) redirect(user.businessId ? "/dashboard" : "/onboarding");
  return <SignUpForm />;
}
