"use client";

import {
  ArrowRight,
  Keyboard,
  Loader2,
  Mic,
  RotateCcw,
  SkipForward,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { textDirection } from "@/lib/intake/language";
import {
  SKIPPED_ANSWER,
  type AnalyzeResponse,
  type ConversationTurnInput,
  type SubmitResponse,
} from "@/lib/intake/types";
import { LIMITS } from "@/lib/constants";
import { normalizePkPhone, formatPkPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { createIntakeApi, type ApiResult, type ClientErrorCode } from "./intake-api";
import { IntakeAlert } from "./intake-alert";
import { RecordButton } from "./record-button";
import { ReviewForm, initialReviewValues, type ReviewValues } from "./review-form";
import { SpeakButton } from "./speak-button";
import { DeleteRequest } from "./delete-request";
import { SuccessPanel } from "./success-panel";
import { useRecorder, type RecorderError } from "./use-recorder";

type Step =
  | "welcome"
  | "recording"
  | "transcribing"
  | "transcript"
  | "analyzing"
  | "clarify"
  | "review"
  | "manual"
  | "submitting"
  | "done"
  | "deleted";

const RECORDER_MESSAGES: Record<RecorderError, string> = {
  denied:
    "Microphone access is blocked. Allow it in your browser's site settings, or type your request instead.",
  no_mic: "We couldn't find a microphone on this device. You can type your request instead.",
  unsupported:
    "Voice recording isn't supported in this browser. You can type your request instead.",
  too_short: "That was too short for us to hear. Tap the microphone and speak for a few seconds.",
  failed: "The microphone couldn't start. Please try again or type your request.",
};

/** Screen-reader announcements for each step (also helps sighted users). */
const STEP_STATUS: Partial<Record<Step, string>> = {
  recording: "Recording. Tap the button again when you are finished.",
  transcribing: "Listening to your message…",
  analyzing: "Understanding your request…",
  submitting: "Sending your request to the clinic…",
};

export interface IntakeBusinessView {
  name: string;
  slug: string;
  phone: string;
  services: string[];
}

export function IntakeFlow({
  business,
  intakeToken,
  todayIso,
}: {
  business: IntakeBusinessView;
  intakeToken: string;
  todayIso: string;
}) {
  const api = useMemo(
    () => createIntakeApi(business.slug, intakeToken),
    [business.slug, intakeToken],
  );
  const recorder = useRecorder();

  const [step, setStep] = useState<Step>("welcome");
  const [typed, setTyped] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [turns, setTurns] = useState<ConversationTurnInput[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);
  const [alert, setAlert] = useState<{
    message: string;
    code?: ClientErrorCode;
    retry?: () => void;
  } | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [manualInitial, setManualInitial] = useState<ReviewValues>(() => initialReviewValues());
  /** The customer's edits on the review screen, kept if sending fails. */
  const [reviewDraft, setReviewDraft] = useState<ReviewValues | null>(null);

  // Move focus to each new step's heading for keyboard and screen-reader users.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  /** Shared failure handling: AI down → short form; expired page → refresh. */
  function fail<T>(res: Extract<ApiResult<T>, { ok: false }>, backTo: Step, retry?: () => void) {
    if (res.code === "ai_unavailable" || res.code === "unsupported_media") {
      setManualInitial({ ...initialReviewValues(analysis?.lead), message: transcript });
      setAlert({ message: res.message, code: res.code });
      setStep("manual");
      return;
    }
    setAlert({ message: res.message, code: res.code, retry });
    setStep(backTo);
  }

  // ── Recording the main request ──────────────────────────────────────
  async function startRequestRecording() {
    setAlert(null);
    if (await recorder.start()) setStep("recording");
  }

  async function finishRequestRecording() {
    const blob = await recorder.stop();
    if (!blob) {
      setStep("welcome");
      return;
    }
    await transcribeRequest(blob);
  }

  async function transcribeRequest(blob: Blob) {
    setStep("transcribing");
    const res = await api.transcribe(blob);
    if (!res.ok) {
      fail(res, "welcome", res.code === "network" ? () => void transcribeRequest(blob) : undefined);
      return;
    }
    setAlert(null);
    setTyped(false);
    setTranscript(res.data.transcript);
    setStep("transcript");
  }

  function typeInstead() {
    setAlert(null);
    setTyped(true);
    setTranscript("");
    setStep("transcript");
  }

  // ── Analysis + clarifying questions ────────────────────────────────
  async function analyze(nextTurns: ConversationTurnInput[], backTo: Step) {
    setStep("analyzing");
    const res = await api.analyze(transcript, nextTurns);
    if (!res.ok) {
      fail(res, backTo, res.code === "network" ? () => void analyze(nextTurns, backTo) : undefined);
      return;
    }
    setAlert(null);
    setTurns(nextTurns);
    setAnalysis(res.data);
    setReviewDraft(null);
    setStep(res.data.question ? "clarify" : "review");
  }

  function sendAnswer(skip: boolean) {
    const question = analysis?.question;
    if (!question) return;
    const content = skip ? SKIPPED_ANSWER : answer.trim();
    if (!content) return;
    const next: ConversationTurnInput[] = [
      ...turns,
      { role: "assistant", content: question.text, field: question.field },
      { role: "customer", content },
    ];
    setAnswer("");
    void analyze(next, "clarify");
  }

  async function recordAnswer() {
    if (recorder.status === "recording") {
      const blob = await recorder.stop();
      if (!blob) return;
      setAnswerBusy(true);
      const res = await api.transcribe(blob);
      setAnswerBusy(false);
      if (res.ok) setAnswer(res.data.transcript.slice(0, LIMITS.maxAnswerChars));
      else setAlert({ message: res.message, code: res.code });
      return;
    }
    setAlert(null);
    await recorder.start();
  }

  // ── Submission ─────────────────────────────────────────────────────
  async function submit(values: ReviewValues, mode: "review" | "manual") {
    setStep("submitting");
    const requestText = mode === "manual" ? values.message : transcript;
    const res = await api.submit({
      transcript: requestText,
      turns: mode === "manual" ? [] : turns,
      extractionToken: mode === "manual" ? undefined : analysis?.extractionToken,
      consent: true,
      fields: {
        customerName: values.customerName || null,
        phone: values.phone,
        serviceNeeded: values.serviceNeeded,
        preferredDate: values.preferredDate || null,
        preferredTime: values.preferredTime || null,
        notes: mode === "manual" ? null : values.notes || null,
      },
    });
    if (!res.ok) {
      if (mode === "manual") setManualInitial(values);
      else setReviewDraft(values);
      setAlert({ message: res.message, code: res.code });
      setStep(mode);
      return;
    }
    const normalized = normalizePkPhone(values.phone);
    setSubmittedPhone(normalized ? formatPkPhone(normalized.e164) : values.phone);
    setResult(res.data);
    setStep("done");
  }

  const recorderMessage = recorder.error ? RECORDER_MESSAGES[recorder.error] : null;
  const busy = step === "transcribing" || step === "analyzing" || step === "submitting";
  const question = analysis?.question ?? null;

  return (
    <Card>
      <CardContent className="space-y-6">
        <p role="status" aria-live="polite" className="sr-only">
          {STEP_STATUS[step] ?? ""}
        </p>

        {alert && step !== "done" && (
          <IntakeAlert message={alert.message} onRetry={alert.retry}>
            {alert.code === "session_expired" && (
              <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            )}
          </IntakeAlert>
        )}
        {recorderMessage && (step === "welcome" || step === "clarify") && (
          <IntakeAlert message={recorderMessage}>
            {step === "welcome" && recorder.error !== "too_short" && (
              <Button type="button" variant="secondary" onClick={typeInstead}>
                <Keyboard aria-hidden="true" /> Type instead
              </Button>
            )}
          </IntakeAlert>
        )}

        {(step === "welcome" || step === "recording") && (
          <section aria-labelledby="step-heading" className="flex flex-col items-center gap-6 py-4">
            <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="sr-only">
              Record your request
            </h2>
            <RecordButton
              status={recorder.status}
              seconds={recorder.seconds}
              maxSeconds={recorder.maxSeconds}
              onStart={startRequestRecording}
              onStop={finishRequestRecording}
            />
            {step === "welcome" && (
              <>
                <p className="text-muted-foreground flex max-w-sm items-start gap-2 text-left text-sm">
                  <ShieldCheck aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
                  <span>
                    Your voice is turned into text and then deleted. Only {business.name} sees your
                    request. Nothing is sent until you confirm.
                  </span>
                </p>
                <Button type="button" variant="link" onClick={typeInstead}>
                  <Keyboard aria-hidden="true" /> Prefer to type?
                </Button>
              </>
            )}
          </section>
        )}

        {busy && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 aria-hidden="true" className="text-primary size-10 animate-spin" />
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
              {STEP_STATUS[step]}
            </h2>
          </div>
        )}

        {step === "transcript" && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div>
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold outline-none"
              >
                {typed ? "Describe what you need" : "Here's what we heard"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {typed
                  ? "Write in Urdu or English, for example: tooth pain since yesterday, want to come tomorrow evening."
                  : "Fix anything we got wrong before continuing."}
              </p>
            </div>
            <Textarea
              aria-label={typed ? "Your request" : "Transcript of your message"}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              dir="auto"
              rows={5}
              maxLength={LIMITS.maxTranscriptChars}
              className={cn(textDirection(transcript) === "rtl" && "font-urdu text-lg")}
            />
            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
              <Button
                type="button"
                size="lg"
                disabled={transcript.trim().length < 2}
                onClick={() => void analyze([], "transcript")}
              >
                Continue <ArrowRight aria-hidden="true" />
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStep("welcome")}>
                {typed ? <Mic aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                {typed ? "Speak instead" : "Record again"}
              </Button>
            </div>
          </section>
        )}

        {step === "clarify" && question && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <p className="text-muted-foreground text-sm font-medium">One quick question</p>
            <div className="bg-primary-soft flex items-start gap-2 rounded-lg p-4">
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                dir="auto"
                className={cn(
                  "flex-1 text-lg font-semibold outline-none",
                  textDirection(question.text) === "rtl" && "font-urdu",
                )}
              >
                {question.text}
              </h2>
              <SpeakButton text={question.text} language={analysis?.lead.language ?? "en"} />
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendAnswer(false);
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  aria-label="Your answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  dir="auto"
                  maxLength={LIMITS.maxAnswerChars}
                  inputMode={question.field === "phone" ? "tel" : "text"}
                  autoComplete={
                    question.field === "phone"
                      ? "tel"
                      : question.field === "customerName"
                        ? "name"
                        : "off"
                  }
                  placeholder={answerBusy ? "Listening…" : "Type or tap the mic"}
                  disabled={answerBusy || recorder.status === "recording"}
                  className="border-border-strong bg-background min-h-12 min-w-0 flex-1 rounded-md border px-3 text-base"
                />
                <RecordButton
                  size="sm"
                  status={recorder.status}
                  seconds={recorder.seconds}
                  maxSeconds={recorder.maxSeconds}
                  onStart={() => void recordAnswer()}
                  onStop={() => void recordAnswer()}
                  label="Answer by voice"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
                <Button type="submit" size="lg" disabled={!answer.trim() || answerBusy}>
                  Next <ArrowRight aria-hidden="true" />
                </Button>
                {question.skippable && (
                  <Button type="button" variant="ghost" onClick={() => sendAnswer(true)}>
                    <SkipForward aria-hidden="true" /> Skip this question
                  </Button>
                )}
              </div>
            </form>
          </section>
        )}

        {(step === "review" || step === "manual") && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <div>
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold outline-none"
              >
                {step === "review" ? "Please check your details" : "Send a short request"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {step === "review"
                  ? "This is what we understood. Change anything that isn't right."
                  : "Just a few details and the clinic will get back to you."}
              </p>
            </div>
            {step === "review" && analysis && (
              <p dir="auto" className="bg-surface rounded-md p-3 text-sm">
                {analysis.lead.summary.replace(/^URGENT:[^.]*\.\s*/, "")}
              </p>
            )}
            <ReviewForm
              key={step}
              mode={step}
              initial={
                step === "review"
                  ? (reviewDraft ?? initialReviewValues(analysis?.lead))
                  : manualInitial
              }
              services={business.services}
              clinicName={business.name}
              clinicPhone={business.phone}
              minDate={todayIso}
              emergency={step === "review" && analysis?.lead.urgency === "emergency"}
              pending={false}
              onSubmit={(values) => void submit(values, step)}
            />
          </section>
        )}

        {step === "done" && result && (
          <section aria-labelledby="done-heading">
            <SuccessPanel
              headingRef={headingRef}
              result={result}
              clinicName={business.name}
              clinicPhone={business.phone}
              customerPhone={submittedPhone}
            >
              <DeleteRequest
                api={api}
                slug={business.slug}
                referenceNumber={result.referenceNumber}
                deletionToken={result.deletionToken}
                onDeleted={() => setStep("deleted")}
              />
            </SuccessPanel>
          </section>
        )}

        {step === "deleted" && (
          <section aria-labelledby="deleted-heading" className="space-y-3 py-6 text-center">
            <h2
              id="deleted-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold outline-none"
            >
              Your request was deleted
            </h2>
            <p className="text-muted-foreground">
              Your details have been removed from {business.name}&rsquo;s list. You can send a new
              request any time.
            </p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
