import { AlertCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/intake/copy";
import { Bi } from "./bi";

/** Error shown to patients: English from the server plus a short Urdu line. */
export function IntakeAlert({
  message,
  urdu,
  onRetry,
  children,
}: {
  message: string;
  urdu?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-urgency-emergency-bg text-destructive rounded-lg border p-4"
    >
      <div className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-medium">{message}</p>
          {urdu && (
            <p lang="ur" dir="rtl" className="font-urdu mt-1">
              {urdu}
            </p>
          )}
        </div>
      </div>
      {(onRetry || children) && (
        <div className="mt-3 flex flex-wrap gap-2 pl-7">
          {onRetry && (
            <Button type="button" variant="secondary" onClick={onRetry}>
              <RefreshCw aria-hidden="true" /> <Bi t={COPY.tryAgain} />
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
