"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      // Clipboard API can be blocked (insecure context, permissions).
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={copy}>
        {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {status === "copied" ? "Copied" : label}
      </Button>
      <span role="status" className="sr-only">
        {status === "copied" ? "Link copied to clipboard" : ""}
        {status === "failed" ? "Couldn't copy automatically. Select the link and copy it." : ""}
      </span>
      {status === "failed" && (
        <p className="text-destructive w-full text-sm">
          Couldn&rsquo;t copy automatically. Select the link above and copy it.
        </p>
      )}
    </>
  );
}
