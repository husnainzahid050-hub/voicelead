import { INTAKE_RATE_LIMITS } from "@/lib/constants";
import type { AnalyzeResponse } from "@/lib/intake/types";
import { analyzeBodySchema } from "@/lib/schemas/intake";
import { AiUnavailableError } from "@/server/ai/provider";
import { errorResponse, jsonResponse, readJson } from "@/server/http";
import { openIntakeRequest } from "@/server/intake-route";
import { IntakeValidationError, analyzeConversation } from "@/server/services/intake";

/** POST { transcript, turns } → extracted lead + next clarifying question. Nothing is saved. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/intake/[slug]/analyze">,
) {
  const { slug } = await params;
  const opened = await openIntakeRequest(
    request,
    slug,
    "analyze",
    INTAKE_RATE_LIMITS.analyzePerIp,
    {
      businessRule: INTAKE_RATE_LIMITS.aiPerBusinessPerHour,
    },
  );
  if (!opened.ok) return opened.response;

  const parsed = analyzeBodySchema.safeParse(await readJson(request, 32 * 1024));
  if (!parsed.success) {
    return errorResponse("invalid_input", { message: parsed.error.issues[0]?.message });
  }

  try {
    return jsonResponse<AnalyzeResponse>(
      await analyzeConversation(opened.ctx.business, parsed.data),
    );
  } catch (error) {
    if (error instanceof IntakeValidationError) {
      return errorResponse("invalid_input", { message: error.message });
    }
    if (error instanceof AiUnavailableError) return errorResponse("ai_unavailable");
    console.error("[intake] analyze failed:", error instanceof Error ? error.name : "unknown");
    return errorResponse("server_error");
  }
}
