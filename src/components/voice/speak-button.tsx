"use client";

import { Volume2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { Language } from "@/types/domain";

const noopSubscribe = () => () => {};

/** Reads a question aloud with the browser's free built-in voice (no paid TTS). */
export function SpeakButton({ text, language }: { text: string; language: Language }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window,
    () => false,
  );
  if (!supported) return null;

  function speak() {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "en" ? "en-US" : "ur-PK";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={speak}
      aria-label="Listen to the question"
    >
      <Volume2 aria-hidden="true" />
    </Button>
  );
}
