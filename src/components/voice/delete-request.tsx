"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/intake-link/copy-button";
import { Button } from "@/components/ui/button";
import type { IntakeApi } from "./intake-api";

/**
 * Lets the customer withdraw a request within 24 hours. The secret lives in
 * the link's #fragment, which browsers never send to the server or to logs.
 */
export function deletionLink(origin: string, slug: string, ref: string, token: string): string {
  return `${origin}/intake/${encodeURIComponent(slug)}/delete#ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`;
}

export function DeleteRequest({
  api,
  referenceNumber,
  deletionToken,
  slug,
  onDeleted,
  showSaveLink = true,
}: {
  api: IntakeApi;
  referenceNumber: string;
  deletionToken: string;
  slug: string;
  onDeleted: () => void;
  showSaveLink?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setPending(true);
    setError(null);
    const res = await api.deleteRequest(referenceNumber, deletionToken);
    setPending(false);
    if (res.ok) onDeleted();
    else setError(res.message);
  }

  const link =
    typeof window === "undefined"
      ? ""
      : deletionLink(window.location.origin, slug, referenceNumber, deletionToken);

  return (
    <div className="border-border space-y-3 rounded-lg border p-4 text-left">
      <p className="text-sm font-medium">Changed your mind?</p>
      {!confirming ? (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          onClick={() => setConfirming(true)}
        >
          <Trash2 aria-hidden="true" /> Delete my request
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            This permanently deletes your request and personal details from the clinic&rsquo;s list.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void confirmDelete()}
            >
              {pending ? "Deleting…" : "Yes, delete it"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      {showSaveLink && link && (
        <div className="border-border space-y-2 border-t pt-3">
          <p className="text-muted-foreground text-sm">
            You can also delete it later (within 24 hours) with this private link. Keep it to
            yourself.
          </p>
          <CopyButton value={link} label="Copy private delete link" />
        </div>
      )}
    </div>
  );
}
