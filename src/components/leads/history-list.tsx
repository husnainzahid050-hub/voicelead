import { formatDateTime } from "@/lib/format";
import type { LeadDetailDTO } from "@/server/services/leads";

const ACTION_LABELS: Record<string, string> = {
  "lead.created": "Request received",
  "lead.viewed": "Viewed",
  "lead.edited": "Details edited",
  "lead.status_changed": "Status changed",
  "lead.deleted": "Deleted",
  "lead.deletion_requested": "Patient asked to delete",
  "followup.generated": "Follow-up drafted",
  "followup.copied": "Follow-up sent out",
};

/** Who did what, when. Read-only: the audit log cannot be edited from the UI. */
export function HistoryList({ history }: { history: LeadDetailDTO["history"] }) {
  if (history.length === 0)
    return <p className="text-muted-foreground text-sm">No activity yet.</p>;
  return (
    <ol className="border-border space-y-3 border-l-2 pl-4">
      {history.map((h, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className="bg-border-strong absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full"
          />
          <p className="text-sm">
            <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
            <span className="text-muted-foreground"> · {h.who}</span>
          </p>
          {h.detail && (
            <p className="text-muted-foreground text-sm">{h.detail.replace(/_/g, " ")}</p>
          )}
          <p className="text-muted-foreground text-xs">
            <time dateTime={h.at}>{formatDateTime(h.at)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
