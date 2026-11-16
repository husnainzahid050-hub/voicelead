import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Disabled while pending so a double tap cannot submit twice. */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  ...props
}: ButtonProps & { pending: boolean; pendingLabel: string }) {
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} {...props}>
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
