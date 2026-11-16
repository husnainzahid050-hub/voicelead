import "server-only";
import { NextResponse } from "next/server";
import type { IntakeErrorBody, IntakeErrorCode } from "@/lib/intake/types";

/**
 * Helpers for Route Handlers. Unlike Server Actions, route handlers get no
 * built-in CSRF protection, so state-changing handlers call isSameOrigin().
 */

/** Customer-facing messages: plain language, never internal details. */
const MESSAGES: Record<IntakeErrorCode, string> = {
  invalid_input: "Some details don't look right. Please check and try again.",
  not_found: "This clinic link isn't valid.",
  inactive: "This clinic isn't taking requests online right now.",
  session_expired: "This page has been open for a while. Please refresh and try again.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  ai_unavailable:
    "We couldn't process your voice right now. Please try again or fill the short form.",
  no_speech:
    "We couldn't hear anything in that recording. Please try again a little closer to the phone.",
  payload_too_large: "That recording is too long. Please keep it under 3 minutes.",
  unsupported_media:
    "Your browser recorded audio in a format we can't read. Please type your request instead.",
  forbidden: "This request was blocked.",
  server_error: "Something went wrong on our side. Please try again.",
};

const STATUS: Record<IntakeErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  inactive: 409,
  session_expired: 401,
  rate_limited: 429,
  ai_unavailable: 503,
  no_speech: 422,
  payload_too_large: 413,
  unsupported_media: 415,
  forbidden: 403,
  server_error: 500,
};

export function errorResponse(
  code: IntakeErrorCode,
  options: { message?: string; retryAfterSeconds?: number } = {},
): NextResponse<IntakeErrorBody> {
  const res = NextResponse.json<IntakeErrorBody>(
    { error: { code, message: options.message ?? MESSAGES[code] } },
    { status: STATUS[code] },
  );
  if (options.retryAfterSeconds) res.headers.set("Retry-After", String(options.retryAfterSeconds));
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function jsonResponse<T>(body: T): NextResponse<T> {
  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * CSRF defence: the browser always sends Origin on cross-site POSTs, and
 * a page on another site cannot forge it. Require it to match our host.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Declared size check before reading the body (the real size is checked after). */
export function declaredTooLarge(request: Request, maxBytes: number): boolean {
  const length = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(length) && length > maxBytes;
}

/** Read a JSON body with a hard size cap. Returns undefined for oversize or invalid JSON. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (declaredTooLarge(request, maxBytes)) return undefined;
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
