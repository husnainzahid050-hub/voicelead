"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { COPY, type BiText } from "@/lib/intake/copy";
import { cn } from "@/lib/utils";
import { Bi } from "./bi";
import { formatClock } from "./use-recorder";

/**
 * The one large control customers need. 128px target, high contrast,
 * label always visible (never icon-only).
 *
 * The ticking timer is deliberately NOT in a live region: announcing it every
 * second would drown out everything else for screen-reader users. Start/stop
 * is announced once by the flow's status region instead.
 */
export function RecordButton({
  status,
  seconds,
  maxSeconds,
  onStart,
  onStop,
  label = COPY.speak,
  size = "lg",
}: {
  status: "idle" | "requesting" | "recording";
  seconds: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  label?: BiText;
  size?: "lg" | "sm";
}) {
  const recording = status === "recording";
  const requesting = status === "requesting";
  const big = size === "lg";
  const nearLimit = recording && maxSeconds - seconds <= 15;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={recording ? onStop : onStart}
        disabled={requesting}
        aria-label={recording ? `Stop recording (${formatClock(seconds)} recorded)` : label.en}
        className={cn(
          "relative grid place-items-center rounded-full text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70",
          big ? "size-32" : "size-14",
          recording ? "bg-destructive" : "bg-primary hover:bg-primary-hover",
        )}
      >
        {recording && (
          <span
            aria-hidden="true"
            className="bg-destructive/40 absolute inset-0 rounded-full motion-safe:animate-ping"
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
        <div className="text-center">
          {recording ? (
            <>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {formatClock(seconds)}{" "}
                <span className="text-muted-foreground text-base">/ {formatClock(maxSeconds)}</span>
              </p>
              {nearLimit && (
                <p className="text-urgency-high text-sm font-medium">
                  Almost at the 3-minute limit
                </p>
              )}
              <Bi t={COPY.tapToFinish} className="text-muted-foreground justify-center" />
            </>
          ) : (
            <Bi
              t={requesting ? COPY.allowMic : label}
              layout="stack"
              className="text-lg font-semibold"
              urClassName="text-muted-foreground text-base font-normal"
            />
          )}
        </div>
      )}
    </div>
  );
}
