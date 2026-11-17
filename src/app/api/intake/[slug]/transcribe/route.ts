import { INTAKE_RATE_LIMITS, LIMITS } from "@/lib/constants";
import type { TranscribeResponse } from "@/lib/intake/types";
import { normalizeAudioMediaType } from "@/lib/schemas/intake";
import { AiUnavailableError } from "@/server/ai/provider";
import { declaredTooLarge, errorResponse, jsonResponse } from "@/server/http";
import { openIntakeRequest } from "@/server/intake-route";
import { NoSpeechError, transcribeAudio } from "@/server/services/intake";

const MIN_AUDIO_BYTES = 500;

/** POST multipart/form-data { audio: Blob } → { transcript, language }. Audio is never stored. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/intake/[slug]/transcribe">,
) {
  const { slug } = await params;
  const opened = await openIntakeRequest(
    request,
    slug,
    "transcribe",
    INTAKE_RATE_LIMITS.transcribePerIp,
    { businessRule: INTAKE_RATE_LIMITS.aiPerBusinessPerHour },
  );
  if (!opened.ok) return opened.response;

  if (declaredTooLarge(request, LIMITS.maxAudioBytes + 64 * 1024))
    return errorResponse("payload_too_large");

  let audio: File;
  try {
    const form = await request.formData();
    const value = form.get("audio");
    if (!(value instanceof File)) return errorResponse("invalid_input");
    audio = value;
  } catch {
    return errorResponse("invalid_input");
  }

  if (audio.size > LIMITS.maxAudioBytes) return errorResponse("payload_too_large");
  if (audio.size < MIN_AUDIO_BYTES) return errorResponse("no_speech");
  const mediaType = normalizeAudioMediaType(audio.type);
  if (!mediaType) return errorResponse("unsupported_media");

  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const result = await transcribeAudio(bytes, mediaType);
    return jsonResponse<TranscribeResponse>(result);
  } catch (error) {
    if (error instanceof NoSpeechError) return errorResponse("no_speech");
    if (error instanceof AiUnavailableError) return errorResponse("ai_unavailable");
    console.error("[intake] transcribe failed:", error instanceof Error ? error.name : "unknown");
    return errorResponse("server_error");
  }
}
