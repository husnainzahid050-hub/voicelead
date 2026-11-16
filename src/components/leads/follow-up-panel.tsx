"use client";

import { Check, Copy, MessageCircle, Save, Sparkles } from "lucide-react";
import { useActionState, useState, startTransition } from "react";
import {
  generateFollowUpAction,
  recordFollowUpCopiedAction,
  saveFollowUpAction,
  type FollowUpActionState,
} from "@/app/dashboard/leads/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/constants";
import { textDirection } from "@/lib/intake/language";
import { whatsappLink } from "@/lib/leads/follow-up";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/types/domain";

/**
 * Draft → review → copy or open in WhatsApp. VoiceLead never sends anything
 * itself: the staff member reads the message and presses Send in WhatsApp.
 */
export function FollowUpPanel({
  leadId,
  initialMessage,
  whatsappDigits,
  status,
}: {
  leadId: string;
  initialMessage: string | null;
  whatsappDigits: string | null;
  status: LeadStatus;
}) {
  const [message, setMessage] = useState(initialMessage ?? "");
  const [copied, setCopied] = useState(false);
  const [generated, generate, generating] = useActionState<FollowUpActionState, FormData>(
    generateFollowUpAction,
    { status: "idle" },
  );
  const save = useFormAction(saveFollowUpAction);

  // Show a freshly generated draft (state-adjust-during-render, no effect needed).
  const [seen, setSeen] = useState(generated);
  if (generated !== seen) {
    setSeen(generated);
    if (generated.followUp) setMessage(generated.followUp);
  }

  function onGenerate() {
    const fd = new FormData();
    fd.set("leadId", leadId);
    startTransition(() => generate(fd));
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      void recordFollowUpCopiedAction(leadId, "copy");
    } catch {
      // Clipboard blocked: the text stays selectable in the box.
    }
  }

  const tooLong = message.length > LIMITS.maxFollowUpChars;
  const hasMessage = message.trim().length > 0;
  const state = save.state.status !== "idle" ? save.state : generated;

  return (
    <div className="space-y-4">
      <FormMessage state={state} />
      {!hasMessage && (
        <p className="text-muted-foreground text-sm">
          Draft a WhatsApp reply in the patient&rsquo;s language. You can edit it before sending.
        </p>
      )}
      <Button
        type="button"
        variant={hasMessage ? "secondary" : "primary"}
        onClick={onGenerate}
        disabled={generating}
      >
        <Sparkles aria-hidden="true" />
        {generating ? "Drafting…" : hasMessage ? "Draft again" : "Draft follow-up message"}
      </Button>

      {hasMessage && (
        <form onSubmit={save.onSubmit} className="space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <label htmlFor="followup-message" className="sr-only">
            Follow-up message
          </label>
          <Textarea
            id="followup-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            dir="auto"
            rows={6}
            aria-invalid={tooLong || undefined}
            aria-describedby="followup-count followup-note"
            className={cn(textDirection(message) === "rtl" && "font-urdu text-lg")}
          />
          <p
            id="followup-count"
            className={cn(
              "text-right text-sm",
              tooLong ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {message.length}/{LIMITS.maxFollowUpChars}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onCopy} disabled={tooLong}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy message"}
            </Button>
            {whatsappDigits && (
              <Button asChild variant="secondary">
                <a
                  href={whatsappLink(whatsappDigits, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void recordFollowUpCopiedAction(leadId, "whatsapp")}
                >
                  <MessageCircle aria-hidden="true" /> Open WhatsApp
                </a>
              </Button>
            )}
            <SubmitButton
              pending={save.pending}
              pendingLabel="Saving…"
              variant="ghost"
              disabled={tooLong}
            >
              <Save aria-hidden="true" /> Save edits
            </SubmitButton>
          </div>
          <span role="status" className="sr-only">
            {copied ? "Message copied" : ""}
          </span>
          <p id="followup-note" className="text-muted-foreground text-sm">
            Nothing is sent automatically. WhatsApp opens with the message filled in; you press
            Send.
            {status !== "booked" && " Don't confirm a time until it's booked."}
          </p>
        </form>
      )}
    </div>
  );
}
