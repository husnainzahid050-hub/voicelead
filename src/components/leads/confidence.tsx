import { confidenceLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * AI confidence, shown as one signal among others (never the only one):
 * a labelled bar plus the percentage, so it is readable without colour.
 */
export function Confidence({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return <span className={cn("text-muted-foreground text-sm", className)}>Entered by hand</span>;
  }
  const label = confidenceLabel(value);
  const pct = Math.round(value * 100);
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span
        aria-hidden="true"
        className="bg-surface-strong relative h-1.5 w-16 overflow-hidden rounded-full"
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            label === "High"
              ? "bg-success"
              : label === "Medium"
                ? "bg-urgency-high"
                : "bg-destructive",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span>
        {label} AI confidence <span className="text-muted-foreground">({pct}%)</span>
      </span>
    </span>
  );
}
