"use client";

import {
  ArrowRight,
  Keyboard,
  Loader2,
  Mic,
  RotateCcw,
  SkipForward,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/constants";
import { COPY, ERROR_UR, RECORDER_COPY, fill, type BiText } from "@/lib/intake/copy";
import { textDirection } from "@/lib/intake/language";
import {
  SKIPPED_ANSWER,
  type AnalyzeResponse,
  type ConversationTurnInput,
  type SubmitResponse,
} from "@/lib/intake/types";
import { formatPkPhone, normalizePkPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Bi } from "./bi";
import { DeleteRequest } from "./delete-request";
import { createIntakeApi, type ApiResult, type ClientErrorCode } from "./intake-api";
import { IntakeAlert } from "./intake-alert";
import { RecordButton } from "./record-button";
import { ReviewForm, initialReviewValues, type ReviewValues } from "./review-form";
import { SpeakButton } from "./speak-button";
import { SuccessPanel } from "./success-panel";
import { useRecorder } from "./use-recorder";

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

/** Screen-reader announcements for each step (announced once, not every second). */
const STEP_STATUS: Partial<Record<Step, BiText>> = {
  recording: { en: "Recording. Tap the button again when you are finished.", ur: "ریکارڈنگ شروع" },
  transcribing: COPY.transcribing,
  analyzing: COPY.analyzing,
  submitting: COPY.submitting,
};

interface AlertState {
  message: string;
  code?: ClientErrorCode;
  retry?: () => void;
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
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

  const [step, setStep] = useState<Step>("welcome");
  const [typed, setTyped] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [turns, setTurns] = useState<ConversationTurnInput[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerHint, setAnswerHint] = useState(false);
  const [answerBusy, setAnswerBusy] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [manualInitial, setManualInitial] = useState<ReviewValues>(() => initialReviewValues());
  /** The customer's edits on the review screen, kept if sending fails. */
  const [reviewDraft, setReviewDraft] = useState<ReviewValues | null>(null);
  /** Incremented per voice answer, so a late transcript can't fill the next question. */
  const answerRequestRef = useRef(0);
  const stepRef = useRef<Step>(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  // Move focus to each new step's heading (not on first load: that would
  // scroll the page and show an invisible focus ring).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // ── Shared helpers ──────────────────────────────────────────────────
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

  async function transcribeAnswer(blob: Blob) {
    const requestId = ++answerRequestRef.current;
    setAnswerBusy(true);
    const res = await api.transcribe(blob);
    if (requestId !== answerRequestRef.current) return; // the patient already moved on
    setAnswerBusy(false);
    if (res.ok) setAnswer(res.data.transcript.slice(0, LIMITS.maxAnswerChars));
    else setAlert({ message: res.message, code: res.code });
  }

  // A recording that reaches the 3-minute limit stops by itself: use it.
  const handleAutoStop = useCallback(
    (blob: Blob) => {
      if (stepRef.current === "recording") void transcribeRequest(blob);
      else if (stepRef.current === "clarify") void transcribeAnswer(blob);
    },
    // transcribe* only use setters, stable refs and `api`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );
  const recorder = useRecorder({ onAutoStop: handleAutoStop });

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

  function typeInstead() {
    setAlert(null);
    recorder.clearError();
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

  async function sendAnswer(skip: boolean) {
    const question = analysis?.question;
    if (!question) return;
    const content = skip ? SKIPPED_ANSWER : answer.trim();
    if (!content) {
      setAnswerHint(true);
      return;
    }
    // Moving on mid-recording: turn the mic off and drop that audio.
    if (recorder.status === "recording") await recorder.cancel();
    answerRequestRef.current++; // ignore any transcription still in flight
    setAnswerBusy(false);
    setAnswerHint(false);
    const next: ConversationTurnInput[] = [
      ...turns,
      { role: "assistant", content: question.text, field: question.field, sig: question.sig },
      { role: "customer", content },
    ];
    setAnswer("");
    void analyze(next, "clarify");
  }

  async function recordAnswer() {
    if (recorder.status === "recording") {
      const blob = await recorder.stop();
      if (blob) await transcribeAnswer(blob);
      return;
    }
    setAlert(null);
    setAnswerHint(false);
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

  const recorderMessage = recorder.error ? RECORDER_COPY[recorder.error] : null;
  const busy = step === "transcribing" || step === "analyzing" || step === "submitting";
  const question = analysis?.question ?? null;
  const answerLocked = answerBusy || recorder.status !== "idle";
  const busyText = STEP_STATUS[step];

  return (
    <Card>
      <CardContent className="space-y-6">
        <p role="status" aria-live="polite" className="sr-only">
          {busyText?.en ?? ""}
        </p>

        {!online && step !== "done" && step !== "deleted" && (
          <div
            role="status"
            className="border-urgency-high/30 bg-urgency-high-bg text-urgency-high flex items-start gap-2 rounded-lg border p-3 text-sm"
          >
            <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <Bi t={COPY.offline} layout="stack" />
          </div>
        )}

        {alert && step !== "done" && (
          <IntakeAlert
            message={alert.message}
            urdu={alert.code ? ERROR_UR[alert.code] : undefined}
            onRetry={alert.retry}
          >
            {alert.code === "session_expired" && (
              <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                <Bi t={COPY.refresh} />
              </Button>
            )}
          </IntakeAlert>
        )}
        {recorderMessage && (step === "welcome" || step === "clarify") && (
          <IntakeAlert message={recorderMessage.en} urdu={recorderMessage.ur}>
            {step === "welcome" && recorder.error !== "too_short" && (
              <Button type="button" variant="secondary" onClick={typeInstead}>
                <Keyboard aria-hidden="true" /> <Bi t={COPY.typeInstead} />
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
              onStart={() => void startRequestRecording()}
              onStop={() => void finishRequestRecording()}
            />
            {step === "welcome" && (
              <>
                <p className="text-muted-foreground flex max-w-sm items-start gap-2 text-left text-sm">
                  <ShieldCheck aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
                  <span>
                    {fill(COPY.privacy.en, business.name)}
                    <span lang="ur" dir="rtl" className="font-urdu mt-1 block">
                      {COPY.privacy.ur}
                    </span>
                  </span>
                </p>
                <Button type="button" variant="link" onClick={typeInstead}>
                  <Keyboard aria-hidden="true" /> <Bi t={COPY.preferType} />
                </Button>
              </>
            )}
          </section>
        )}

        {busy && busyText && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 aria-hidden="true" className="text-primary size-10 motion-safe:animate-spin" />
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
              <Bi
                t={busyText}
                layout="stack"
                urClassName="text-muted-foreground text-base font-normal"
              />
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
                <Bi
                  t={typed ? COPY.describeTitle : COPY.heardTitle}
                  layout="stack"
                  urClassName="text-base font-normal"
                />
              </h2>
              <p className="text-muted-foreground text-sm">
                <Bi t={typed ? COPY.describeHint : COPY.heardHint} layout="stack" />
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
                disabled={transcript.trim().length < 2 || !online}
                onClick={() => void analyze([], "transcript")}
              >
                <Bi t={COPY.continue} /> <ArrowRight aria-hidden="true" />
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStep("welcome")}>
                {typed ? <Mic aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                <Bi t={typed ? COPY.speakInstead : COPY.recordAgain} />
              </Button>
            </div>
          </section>
        )}

        {step === "clarify" && question && (
          <section aria-labelledby="step-heading" className="space-y-4">
            <p className="text-muted-foreground text-sm font-medium">
              <Bi t={COPY.oneQuestion} />
            </p>
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
                void sendAnswer(false);
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  aria-label="Your answer"
                  aria-describedby={answerHint ? "answer-hint" : undefined}
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setAnswerHint(false);
                  }}
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
                  placeholder={
                    answerBusy
                      ? "Listening… / سن رہے ہیں"
                      : `${COPY.answerPlaceholder.en} / ${COPY.answerPlaceholder.ur}`
                  }
                  disabled={answerLocked}
                  className="border-border-strong bg-background min-h-12 min-w-0 flex-1 rounded-md border px-3 text-base"
                />
                <RecordButton
                  size="sm"
                  status={recorder.status}
                  seconds={recorder.seconds}
                  maxSeconds={recorder.maxSeconds}
                  onStart={() => void recordAnswer()}
                  onStop={() => void recordAnswer()}
                  label={{ en: "Answer by voice", ur: "بول کر جواب دیں" }}
                />
              </div>
              {recorder.status === "recording" && (
                <p className="text-destructive text-sm font-medium">
                  ● {Math.floor(recorder.seconds / 60)}:
                  {String(recorder.seconds % 60).padStart(2, "0")} <Bi t={COPY.recordingAnswer} />
                </p>
              )}
              {answerHint && (
                <p id="answer-hint" className="text-urgency-high text-sm font-medium">
                  <Bi t={COPY.answerEmpty} />
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
                <Button type="submit" size="lg" disabled={answerLocked || !online}>
                  <Bi t={COPY.next} /> <ArrowRight aria-hidden="true" />
                </Button>
                {question.skippable && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={answerBusy || !online}
                    onClick={() => void sendAnswer(true)}
                  >
                    <SkipForward aria-hidden="true" /> <Bi t={COPY.skip} />
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
                <Bi
                  t={step === "review" ? COPY.reviewTitle : COPY.manualTitle}
                  layout="stack"
                  urClassName="text-base font-normal"
                />
              </h2>
              <p className="text-muted-foreground text-sm">
                <Bi t={step === "review" ? COPY.reviewHint : COPY.manualHint} layout="stack" />
              </p>
            </div>
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
