import { INTAKE_RATE_LIMITS } from "@/lib/constants";
import { deleteRequestBodySchema } from "@/lib/schemas/intake";
import { errorResponse, jsonResponse, readJson } from "@/server/http";
import { openIntakeRequest } from "@/server/intake-route";
import { deleteRequestByCustomer } from "@/server/services/intake";

const NOT_DELETED =
  "We couldn't delete this request. The 24-hour window may have passed, or it was already deleted. Please contact the clinic directly.";

/** POST { referenceNumber, deletionToken } → erases the customer's own request (24h window). */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/intake/[slug]/delete">,
) {
  const { slug } = await params;
  // Deletion stays possible even while the clinic has paused new requests.
  const opened = await openIntakeRequest(request, slug, "delete", INTAKE_RATE_LIMITS.deletePerIp, {
    allowInactive: true,
  });
  if (!opened.ok) return opened.response;

  const parsed = deleteRequestBodySchema.safeParse(await readJson(request, 2 * 1024));
  // Same answer for malformed, unknown, expired or wrong-token requests (no oracle).
  if (!parsed.success) return errorResponse("invalid_input", { message: NOT_DELETED });

  try {
    const deleted = await deleteRequestByCustomer(
      opened.ctx.business,
      parsed.data.referenceNumber,
      parsed.data.deletionToken,
      opened.ctx.ipHash,
    );
    if (!deleted) return errorResponse("invalid_input", { message: NOT_DELETED });
    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error("[intake] delete failed:", error instanceof Error ? error.name : "unknown");
    return errorResponse("server_error");
  }
}
