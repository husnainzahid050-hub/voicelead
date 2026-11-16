import { INTAKE_RATE_LIMITS } from "@/lib/constants";
import type { SubmitResponse } from "@/lib/intake/types";
import { submitBodySchema } from "@/lib/schemas/intake";
import { errorResponse, jsonResponse, readJson } from "@/server/http";
import { openIntakeRequest } from "@/server/intake-route";
import { countLeadsSince } from "@/server/repositories/lead";
import { IntakeValidationError, submitIntake } from "@/server/services/intake";

/** POST the confirmed request → saved lead + reference number. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/intake/[slug]/submit">,
) {
  const { slug } = await params;
  const opened = await openIntakeRequest(request, slug, "submit", INTAKE_RATE_LIMITS.submitPerIp);
  if (!opened.ok) return opened.response;
  const { business, ipHash } = opened.ctx;

  // Per-clinic daily cap: limits the damage of a distributed spam run.
  const today = await countLeadsSince(business.id, new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (today >= INTAKE_RATE_LIMITS.submitPerBusinessPerDay) {
    console.warn("[intake] daily submission cap reached for a business");
    return errorResponse("rate_limited", {
      message:
        "This clinic is receiving a very high number of requests. Please call them directly.",
    });
  }

  const parsed = submitBodySchema.safeParse(await readJson(request, 64 * 1024));
  if (!parsed.success) {
    return errorResponse("invalid_input", { message: parsed.error.issues[0]?.message });
  }

  try {
    return jsonResponse<SubmitResponse>(await submitIntake(business, parsed.data, ipHash));
  } catch (error) {
    if (error instanceof IntakeValidationError) {
      return errorResponse("invalid_input", { message: error.message });
    }
    console.error("[intake] submit failed:", error instanceof Error ? error.name : "unknown");
    return errorResponse("server_error");
  }
}
