"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { actionError, formText, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { DASHBOARD_RATE_LIMITS } from "@/lib/constants";
import {
  followUpSaveSchema,
  internalNotesSchema,
  leadFieldsUpdateSchema,
  leadIdSchema,
  statusChangeSchema,
} from "@/lib/schemas/lead";
import { requireBusinessUser, toAuthContext } from "@/server/auth/guards";
import { ForbiddenError, type AuthContext } from "@/server/auth/types";
import { consume, describeRetry, type RateLimitRule } from "@/server/rate-limit";
import { getClientIpHash } from "@/server/request";
import {
  LeadNotFoundError,
  LeadRuleError,
  changeLeadStatus,
  deleteLead,
  generateFollowUp,
  recordFollowUpCopied,
  saveFollowUp,
  saveInternalNotes,
  updateLeadFields,
} from "@/server/services/leads";

export interface FollowUpActionState extends ActionState {
  followUp?: string;
  source?: "ai" | "template";
}

/**
 * Every lead action: authenticate from the session (never from the form),
 * rate-limit per user, run, and translate known errors into friendly messages.
 */
async function run<S extends ActionState>(
  rule: RateLimitRule,
  bucket: string,
  fn: (ctx: AuthContext, ipHash: string) => Promise<S>,
): Promise<S | ActionState> {
  const ctx = toAuthContext(await requireBusinessUser());
  const limit = await consume(`dash:${bucket}:${ctx.userId}`, rule);
  if (limit.limited) {
    return actionError(
      `You're doing that very quickly. Please wait ${describeRetry(limit.retryAfterSeconds)}.`,
    );
  }
  try {
    return await fn(ctx, await getClientIpHash());
  } catch (error) {
    if (error instanceof LeadNotFoundError) return actionError("This lead no longer exists.");
    if (error instanceof LeadRuleError) return actionError(error.message);
    if (error instanceof ForbiddenError)
      return actionError("You don't have permission to do that.");
    throw error;
  }
}

const MUTATION = DASHBOARD_RATE_LIMITS.mutationsPerUser;

export async function updateLeadFieldsAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return run(MUTATION, "mut", async (ctx, ipHash) => {
    const id = leadIdSchema.safeParse(formText(fd, "leadId"));
    if (!id.success) return actionError("This lead no longer exists.");
    const parsed = leadFieldsUpdateSchema.safeParse({
      customerName: formText(fd, "customerName"),
      phone: formText(fd, "phone"),
      serviceNeeded: formText(fd, "serviceNeeded"),
      urgency: formText(fd, "urgency"),
      preferredDate: formText(fd, "preferredDate"),
      preferredTime: formText(fd, "preferredTime"),
      notes: formText(fd, "notes"),
      summary: formText(fd, "summary"),
    });
    if (!parsed.success)
      return actionError("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    const result = await updateLeadFields(ctx, id.data, parsed.data, ipHash);
    refresh();
    return {
      status: "success",
      message: result.changed.length ? "Details saved." : "No changes to save.",
    };
  });
}

export async function changeStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(MUTATION, "mut", async (ctx, ipHash) => {
    const parsed = statusChangeSchema.safeParse({
      leadId: formText(fd, "leadId"),
      to: formText(fd, "to"),
    });
    if (!parsed.success) return actionError("That status change isn't allowed.");
    await changeLeadStatus(ctx, parsed.data.leadId, parsed.data.to, ipHash);
    refresh();
    return { status: "success", message: "Status updated." };
  });
}

export async function saveNotesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(MUTATION, "mut", async (ctx, ipHash) => {
    const parsed = internalNotesSchema.safeParse({
      leadId: formText(fd, "leadId"),
      internalNotes: formText(fd, "internalNotes"),
    });
    if (!parsed.success) return actionError("Notes are too long.", zodFieldErrors(parsed.error));
    await saveInternalNotes(ctx, parsed.data.leadId, parsed.data.internalNotes, ipHash);
    refresh();
    return { status: "success", message: "Notes saved." };
  });
}

export async function generateFollowUpAction(
  _prev: FollowUpActionState,
  fd: FormData,
): Promise<FollowUpActionState> {
  return run(DASHBOARD_RATE_LIMITS.followUpAiPerUser, "ai", async (ctx, ipHash) => {
    const id = leadIdSchema.safeParse(formText(fd, "leadId"));
    if (!id.success) return actionError("This lead no longer exists.");
    const { message, source } = await generateFollowUp(ctx, id.data, ipHash);
    refresh();
    return {
      status: "success",
      message:
        source === "ai"
          ? "Message drafted. Review it before sending."
          : "Message drafted from the template. Review it before sending.",
      followUp: message,
      source,
    } satisfies FollowUpActionState;
  });
}

export async function saveFollowUpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(MUTATION, "mut", async (ctx) => {
    const parsed = followUpSaveSchema.safeParse({
      leadId: formText(fd, "leadId"),
      message: formText(fd, "message"),
    });
    if (!parsed.success)
      return actionError("Please check the message.", zodFieldErrors(parsed.error));
    await saveFollowUp(ctx, parsed.data.leadId, parsed.data.message);
    refresh();
    return { status: "success", message: "Message saved." };
  });
}

/** Called after the browser copies the message or opens WhatsApp (for the audit log). */
export async function recordFollowUpCopiedAction(
  leadId: string,
  channel: "copy" | "whatsapp",
): Promise<void> {
  const id = leadIdSchema.safeParse(leadId);
  if (!id.success || (channel !== "copy" && channel !== "whatsapp")) return;
  await run(MUTATION, "mut", async (ctx, ipHash) => {
    await recordFollowUpCopied(ctx, id.data, channel, ipHash);
    return { status: "success" } satisfies ActionState;
  });
}

export async function deleteLeadAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await run(MUTATION, "mut", async (ctx, ipHash) => {
    const id = leadIdSchema.safeParse(formText(fd, "leadId"));
    if (!id.success) return actionError("This lead no longer exists.");
    if (formText(fd, "confirm") !== "delete") return actionError("Please confirm the deletion.");
    await deleteLead(ctx, id.data, ipHash);
    return { status: "success" } satisfies ActionState;
  });
  if (result.status === "success") redirect("/dashboard/leads?deleted=1");
  return result;
}
