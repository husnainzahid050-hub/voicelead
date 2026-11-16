"use server";

import { redirect } from "next/navigation";
import { actionError, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { businessProfileSchema, readBusinessForm } from "@/lib/schemas/business";
import { requireUser } from "@/server/auth/guards";
import { getClientIpHash } from "@/server/request";
import { completeOnboarding } from "@/server/services/onboarding";

export async function completeOnboardingAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.businessId) redirect("/dashboard");

  const parsed = businessProfileSchema.safeParse(readBusinessForm(fd));
  if (!parsed.success) {
    return actionError("A few details need attention.", zodFieldErrors(parsed.error));
  }

  const result = await completeOnboarding(user, parsed.data, await getClientIpHash());
  if (!result.ok) redirect("/dashboard"); // already set up (double submit or second tab)

  redirect("/dashboard/intake-link?welcome=1");
}
