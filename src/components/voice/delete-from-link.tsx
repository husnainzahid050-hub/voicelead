"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DeleteRequest } from "./delete-request";
import { createIntakeApi } from "./intake-api";

const noopSubscribe = () => () => {};

/** Read "#ref=VL-…&t=…" without ever sending it to the server in a URL. */
function readFragment(): string {
  return window.location.hash.slice(1);
}

export function DeleteFromLink({
  slug,
  clinicName,
  intakeToken,
}: {
  slug: string;
  clinicName: string;
  intakeToken: string;
}) {
  const fragment = useSyncExternalStore(noopSubscribe, readFragment, () => "");
  const [deleted, setDeleted] = useState(false);
  const api = useMemo(() => createIntakeApi(slug, intakeToken), [slug, intakeToken]);

  const params = new URLSearchParams(fragment);
  const ref = params.get("ref");
  const token = params.get("t");

  if (deleted) {
    return (
      <div role="status" className="space-y-2 text-center">
        <CheckCircle2 aria-hidden="true" className="text-success mx-auto size-12" />
        <p className="font-semibold">Your request was deleted.</p>
        <p className="text-muted-foreground">
          Your details have been removed from {clinicName}&rsquo;s list.
        </p>
      </div>
    );
  }
  if (!ref || !token) {
    return (
      <p className="text-muted-foreground">
        This link is incomplete. Please open the full link you saved, or contact {clinicName}{" "}
        directly.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p>
        Request <strong className="font-mono">{ref}</strong> to {clinicName}. You can delete it
        within 24 hours of sending it.
      </p>
      <DeleteRequest
        api={api}
        slug={slug}
        referenceNumber={ref}
        deletionToken={token}
        onDeleted={() => {
          // Remove the secret from the address bar and history.
          window.history.replaceState(null, "", window.location.pathname);
          setDeleted(true);
        }}
        showSaveLink={false}
      />
    </div>
  );
}
