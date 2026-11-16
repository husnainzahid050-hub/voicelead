import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { CardSkeleton } from "@/components/skeleton";
import { greetingName } from "@/lib/names";
import { requireUser } from "@/server/auth/guards";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your clinic" };

export default function OnboardingPage() {
  return (
    <div className="bg-surface flex flex-1 flex-col">
      <header className="px-4 py-5 sm:px-6">
        <Brand href="/onboarding" />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 sm:px-6">
        <Suspense fallback={<CardSkeleton lines={4} label="Loading clinic setup" />}>
          <OnboardingGate />
        </Suspense>
      </main>
    </div>
  );
}

async function OnboardingGate() {
  const user = await requireUser();
  if (user.businessId) redirect("/dashboard");
  return <OnboardingForm firstName={greetingName(user.name)} />;
}
