"use client";

import type {
  AnalyzeResponse,
  ConversationTurnInput,
  IntakeErrorBody,
  IntakeErrorCode,
  SubmitResponse,
  TranscribeResponse,
} from "@/lib/intake/types";

export type ClientErrorCode = IntakeErrorCode | "network";
export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; code: ClientErrorCode; message: string };

const NETWORK_MESSAGE =
  "We couldn't reach the clinic's page. Please check your internet connection and try again.";

/** Thin fetch wrapper: never throws, always returns a friendly, typed result. */
async function call<T>(url: string, token: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), "x-intake-token": token },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "network", message: NETWORK_MESSAGE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through
  }
  if (res.ok && body) return { ok: true, data: body as T };
  const err = (body as IntakeErrorBody | null)?.error;
  return {
    ok: false,
    code: err?.code ?? "server_error",
    message: err?.message ?? "Something went wrong on our side. Please try again.",
  };
}

export function createIntakeApi(slug: string, token: string) {
  const base = `/api/intake/${encodeURIComponent(slug)}`;
  return {
    transcribe(audio: Blob) {
      const form = new FormData();
      form.append("audio", audio, "request");
      return call<TranscribeResponse>(`${base}/transcribe`, token, { method: "POST", body: form });
    },
    analyze(transcript: string, turns: ConversationTurnInput[]) {
      return call<AnalyzeResponse>(`${base}/analyze`, token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript, turns }),
      });
    },
    submit(body: {
      transcript: string;
      turns: ConversationTurnInput[];
      fields: Record<string, string | null>;
      extractionToken?: string;
      consent: true;
    }) {
      return call<SubmitResponse>(`${base}/submit`, token, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
  };
}

export type IntakeApi = ReturnType<typeof createIntakeApi>;
