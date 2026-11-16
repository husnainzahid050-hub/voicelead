"use server";

import { actionError, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { businessSettingsSchema, readBusinessForm } from "@/lib/schemas/business";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { ForbiddenError } from "@/server/auth/types";
import { getClientIpHash } from "@/server/request";
import { updateBusinessSettings } from "@/server/services/business-settings";

/**
 * Server Actions are public endpoints: this re-authenticates and
 * re-authorizes on every call, regardless of what the UI showed.
 */
export async function updateSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = toAuthContext(await requireBusinessUser());

  const parsed = businessSettingsSchema.safeParse(readBusinessForm(fd));
  if (!parsed.success) {
    return actionError("A few details need attention.", zodFieldErrors(parsed.error));
  }

  try {
    const result = await updateBusinessSettings(ctx, parsed.data, await getClientIpHash());
    if (!result.ok) return actionError("A few details need attention.", result.fieldErrors);
    return {
      status: "success",
      message: result.changed.length > 0 ? "Settings saved." : "No changes to save.",
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return actionError("Only the clinic owner can change settings.");
    }
    throw error;
  }
}
