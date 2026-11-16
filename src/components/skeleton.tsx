import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-surface-strong animate-pulse rounded-md", className)}
    />
  );
}

/** Generic placeholder for a card-shaped region that is still loading. */
export function CardSkeleton({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="border-border bg-background space-y-3 rounded-lg border p-6"
    >
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
