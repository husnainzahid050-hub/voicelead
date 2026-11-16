import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/dashboard/access-denied";
import { PageHeader } from "@/components/dashboard/page-header";
import { CardSkeleton } from "@/components/skeleton";
import { formatPkPhone } from "@/lib/phone";
import { can } from "@/lib/permissions";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { getBusinessSettings } from "@/server/services/business-settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Clinic settings"
        description="What patients see, and how VoiceLead talks to them."
      />
      <Suspense fallback={<CardSkeleton lines={5} label="Loading settings" />}>
        <SettingsGate />
      </Suspense>
    </>
  );
}

async function SettingsGate() {
  const user = await requireBusinessUser();
  // Server-side check: staff never receive the settings data, not just a hidden link.
  if (!can(user.role, "settings:read")) {
    return (
      <AccessDenied
        title="Only the clinic owner can change settings"
        body="Ask the owner of this clinic if something here needs updating. You can still view leads and share the intake link."
      />
    );
  }

  const settings = await getBusinessSettings(toAuthContext(user));
  return (
    <SettingsForm
      initial={{
        ...settings,
        phone: formatPkPhone(settings.phone),
        address: settings.address ?? "",
        intakeInstructions: settings.intakeInstructions ?? "",
        description: settings.description ?? "",
        email: settings.email ?? "",
      }}
    />
  );
}
