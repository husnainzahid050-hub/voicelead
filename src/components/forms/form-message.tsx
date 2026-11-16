import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

/**
 * Form-level result. role="alert" for errors (announced immediately),
 * role="status" for success (announced politely).
 */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        isError
          ? "border-destructive/30 bg-urgency-emergency-bg text-destructive"
          : "border-success/30 bg-status-booked-bg text-success",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{state.message}</p>
    </div>
  );
}
