"use client";

import { CheckCircle2, Phone } from "lucide-react";
import type { Ref } from "react";
import { CopyButton } from "@/components/intake-link/copy-button";
import { formatPkPhone } from "@/lib/phone";
import type { SubmitResponse } from "@/lib/intake/types";

export function SuccessPanel({
  result,
  clinicName,
  clinicPhone,
  customerPhone,
  headingRef,
}: {
  result: SubmitResponse;
  clinicName: string;
  clinicPhone: string;
  customerPhone: string;
  /** Receives focus when the panel appears. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const urgent = result.urgency === "emergency" || result.urgency === "high";
  return (
    <div className="space-y-6 text-center">
      <CheckCircle2 aria-hidden="true" className="text-success mx-auto size-16" />
      <div>
        <h2
          id="done-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight outline-none"
        >
          Request sent
        </h2>
        <p lang="ur" dir="rtl" className="text-muted-foreground">
          آپ کی درخواست بھیج دی گئی ہے
        </p>
      </div>

      <div className="border-border bg-surface rounded-lg border p-5">
        <p className="text-muted-foreground text-sm">Your reference number</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wider">{result.referenceNumber}</p>
        <div className="mt-3 flex justify-center">
          <CopyButton value={result.referenceNumber} label="Copy reference" />
        </div>
      </div>

      <p className="text-left">
        <strong>{clinicName}</strong> will review your request and contact you on{" "}
        <strong className="whitespace-nowrap">{customerPhone}</strong>. Please keep your reference
        number in case you need to call them.
      </p>
      <p className="text-muted-foreground text-left text-sm">
        Your appointment is not confirmed until the clinic contacts you.
      </p>

      {urgent && (
        <a
          href={`tel:${clinicPhone}`}
          className="bg-destructive inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-4 font-semibold text-white"
        >
          <Phone aria-hidden="true" className="size-5" /> In severe pain? Call{" "}
          {formatPkPhone(clinicPhone)}
        </a>
      )}
    </div>
  );
}
