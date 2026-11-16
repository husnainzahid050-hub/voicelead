import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function IntakeAlert({
  message,
  onRetry,
  retryLabel = "Try again",
  children,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-urgency-emergency-bg text-destructive rounded-lg border p-4"
    >
      <div className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p className="font-medium">{message}</p>
      </div>
      {(onRetry || children) && (
        <div className="mt-3 flex flex-wrap gap-2 pl-7">
          {onRetry && (
            <Button type="button" variant="secondary" onClick={onRetry}>
              <RefreshCw aria-hidden="true" /> {retryLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
