import type { ZodError } from "zod";

/** Shape returned by every form Server Action (used with useActionState). */
export interface ActionState {
  status: "idle" | "error" | "success";
  /** Form-level message, safe to show the user. */
  message?: string;
  /** Field name → first error message. Keys match input `name`s. */
  fieldErrors?: Record<string, string>;
  /**
   * Set when the client must do a full page load (not a client navigation),
   * e.g. after sign-in, so no hidden page from a previous session survives.
   */
  redirectTo?: string;
}

export const IDLE: ActionState = { status: "idle" };

/** FormData text value, "" when missing or a File (never null). */
export function formText(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value : "";
}

export function actionError(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}

/**
 * Flatten Zod issues to { "workingHours": "...", "phone": "..." }.
 * Nested paths collapse to their top-level field so they map to one input group.
 */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
