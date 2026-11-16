"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/constants";

export type RecorderError = "denied" | "no_mic" | "unsupported" | "too_short" | "failed";
export type RecorderStatus = "idle" | "requesting" | "recording";

/** Browser-supported container, most compatible with the AI first. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Recordings shorter than this are almost always accidental taps. */
const MIN_SECONDS = 1.5;

/**
 * Microphone recording with a hard time limit. The audio stays in memory in
 * the browser until the caller uploads it; nothing is persisted locally.
 */
export function useRecorder(maxSeconds: number = LIMITS.maxAudioSeconds) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const releaseMic = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Never leave the microphone on after the component goes away.
  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMic();
    },
    [releaseMic],
  );

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("unsupported");
      return false;
    }
    setStatus("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError"
            ? "no_mic"
            : "failed",
      );
      setStatus("idle");
      return false;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined,
      );
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError("unsupported");
      setStatus("idle");
      return false;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      releaseMic();
      setStatus("idle");
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      chunksRef.current = [];
      if (elapsed < MIN_SECONDS) {
        setError("too_short");
        resolveRef.current?.(null);
      } else {
        resolveRef.current?.(blob);
      }
      resolveRef.current = null;
    };

    startedAtRef.current = Date.now();
    setSeconds(0);
    recorder.start(1000);
    setStatus("recording");
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSeconds(elapsed);
      // Hard cap: stop automatically at the limit.
      if (elapsed >= maxSeconds && recorder.state === "recording") recorder.stop();
    }, 250);
    return true;
  }, [maxSeconds, releaseMic]);

  const clearError = useCallback(() => setError(null), []);

  return { status, seconds, maxSeconds, error, start, stop, clearError };
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
