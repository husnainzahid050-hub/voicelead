import { textDirection } from "@/lib/intake/language";
import { SKIPPED_ANSWER } from "@/lib/intake/types";
import { cn } from "@/lib/utils";
import type { LeadDetailDTO } from "@/server/services/leads";

/** The original words, exactly as received: the source of truth staff check against. */
export function ConversationPanel({ lead }: { lead: LeadDetailDTO }) {
  const [first, ...rest] = lead.turns;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-muted-foreground text-sm font-semibold">Original message</h3>
        <blockquote
          dir="auto"
          className={cn(
            "border-primary bg-surface mt-2 rounded-md border-l-4 p-3 whitespace-pre-wrap",
            textDirection(lead.transcript) === "rtl" && "font-urdu text-lg",
          )}
        >
          {first?.content ?? lead.transcript}
        </blockquote>
      </div>
      {rest.length > 0 && (
        <div>
          <h3 className="text-muted-foreground text-sm font-semibold">Follow-up questions</h3>
          <ol className="mt-2 space-y-2">
            {rest.map((turn, i) => {
              const skipped = turn.content === SKIPPED_ANSWER;
              const rtl = textDirection(turn.content) === "rtl";
              return (
                <li
                  key={i}
                  className={cn(
                    "flex",
                    turn.role === "assistant" ? "justify-start" : "justify-end",
                  )}
                >
                  <p
                    dir="auto"
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      turn.role === "assistant" ? "bg-surface-strong" : "bg-primary-soft",
                      rtl && "font-urdu text-base",
                      skipped && "text-muted-foreground italic",
                    )}
                  >
                    <span className="sr-only">
                      {turn.role === "assistant" ? "Question: " : "Patient: "}
                    </span>
                    {skipped ? "Skipped" : turn.content}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
