"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock } from "./use-recorder";

/**
 * The one large control customers need. 128px target, high contrast,
 * label always visible (never icon-only).
 */
export function RecordButton({
  status,
  seconds,
  maxSeconds,
  onStart,
  onStop,
  label = "Speak your request",
  sublabel = "اپنی بات بولیں",
  size = "lg",
}: {
  status: "idle" | "requesting" | "recording";
  seconds: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  label?: string;
  sublabel?: string;
  size?: "lg" | "sm";
}) {
  const recording = status === "recording";
  const requesting = status === "requesting";
  const big = size === "lg";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={recording ? onStop : onStart}
        disabled={requesting}
        aria-label={recording ? `Stop recording (${formatClock(seconds)} recorded)` : label}
        className={cn(
          "relative grid place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70",
          big ? "size-32" : "size-16",
          recording ? "bg-destructive" : "bg-primary hover:bg-primary-hover",
        )}
      >
        {recording && (
          <span
            aria-hidden="true"
            className="bg-destructive/40 absolute inset-0 animate-ping rounded-full"
          />
        )}
        {requesting ? (
          <Loader2 aria-hidden="true" className={cn("animate-spin", big ? "size-12" : "size-6")} />
        ) : recording ? (
          <Square aria-hidden="true" className={cn("fill-current", big ? "size-10" : "size-5")} />
        ) : (
          <Mic aria-hidden="true" className={big ? "size-14" : "size-7"} />
        )}
      </button>
      {big && (
        <div className="text-center" aria-live="polite">
          {recording ? (
            <>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {formatClock(seconds)}{" "}
                <span className="text-muted-foreground text-base">/ {formatClock(maxSeconds)}</span>
              </p>
              <p className="text-muted-foreground">Tap to finish</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {requesting ? "Allow microphone access…" : label}
              </p>
              <p lang="ur" dir="rtl" className="text-muted-foreground">
                {sublabel}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
