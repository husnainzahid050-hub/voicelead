import type { BiText } from "@/lib/intake/copy";
import { cn } from "@/lib/utils";

/**
 * English with its Urdu translation. "inline" for short labels and buttons
 * ("Next · آگے"), "stack" for headings and longer text (Urdu on its own line).
 *
 * Nastaliq script needs much more line height than Latin text, so both layouts
 * set it explicitly (parents like <label> use leading-none).
 */
export function Bi({
  t,
  layout = "inline",
  className,
  urClassName,
}: {
  t: BiText;
  layout?: "inline" | "stack";
  className?: string;
  urClassName?: string;
}) {
  if (layout === "stack") {
    return (
      <span className={cn("flex flex-col gap-0.5 pb-1", className)}>
        <span>{t.en}</span>
        <span lang="ur" dir="rtl" className={cn("font-urdu leading-[2]", urClassName)}>
          {t.ur}
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-[1.9]",
        className,
      )}
    >
      <span>{t.en}</span>
      <span aria-hidden="true" className="opacity-60">
        ·
      </span>
      <span
        lang="ur"
        dir="rtl"
        className={cn("font-urdu text-[0.95em] leading-[1.9]", urClassName)}
      >
        {t.ur}
      </span>
    </span>
  );
}
