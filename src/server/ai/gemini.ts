import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { FollowUpInput } from "@/lib/leads/follow-up";
import { generateText, Output, type LanguageModel } from "ai";
import {
  aiExtractionSchema,
  aiFollowUpSchema,
  aiQuestionSchema,
  aiTranscriptionSchema,
  type AiExtraction,
  type AiTranscription,
} from "./schemas";
import {
  extractionPrompt,
  extractionSystem,
  followUpPrompt,
  questionPrompt,
  TRANSCRIPTION_SYSTEM,
} from "./prompts";
import {
  AiUnavailableError,
  type ExtractionInput,
  type LeadAI,
  type QuestionInput,
} from "./provider";

/** Retries cover transient 429/5xx; timeouts keep the customer from waiting forever. */
const REQUEST = { maxRetries: 2 } as const;

export class GeminiLeadAI implements LeadAI {
  readonly name = "gemini" as const;
  private readonly model: LanguageModel;

  constructor(apiKey: string, modelId: string) {
    this.model = createGoogleGenerativeAI({ apiKey })(modelId);
  }

  async transcribe(audio: Uint8Array, mediaType: string): Promise<AiTranscription> {
    return this.call("transcribe", async () => {
      const { output } = await generateText({
        ...REQUEST,
        model: this.model,
        timeout: 45_000,
        temperature: 0,
        output: Output.object({ schema: aiTranscriptionSchema }),
        system: TRANSCRIPTION_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "file", mediaType, data: audio },
              { type: "text", text: "Transcribe this voice message." },
            ],
          },
        ],
      });
      return output;
    });
  }

  async extract(input: ExtractionInput): Promise<AiExtraction> {
    return this.call("extract", async () => {
      const { output } = await generateText({
        ...REQUEST,
        model: this.model,
        timeout: 25_000,
        temperature: 0.1,
        output: Output.object({ schema: aiExtractionSchema }),
        system: extractionSystem(input),
        prompt: extractionPrompt(input),
      });
      return output;
    });
  }

  async clarifyingQuestion(input: QuestionInput): Promise<string> {
    return this.call("question", async () => {
      const { output } = await generateText({
        maxRetries: 1,
        model: this.model,
        timeout: 8_000,
        temperature: 0.3,
        output: Output.object({ schema: aiQuestionSchema }),
        prompt: questionPrompt(input.field, input.language, input.businessName),
      });
      return output.question;
    });
  }

  async followUpMessage(input: FollowUpInput): Promise<string> {
    return this.call("follow-up", async () => {
      const { output } = await generateText({
        ...REQUEST,
        model: this.model,
        timeout: 15_000,
        temperature: 0.4,
        output: Output.object({ schema: aiFollowUpSchema }),
        prompt: followUpPrompt(input),
      });
      return output.message;
    });
  }

  /** Normalise every failure to AiUnavailableError, logging only the operation and error type. */
  private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // Never log prompts, transcripts, keys or provider payloads.
      const kind = error instanceof Error ? error.name : "UnknownError";
      console.error(`[ai] gemini ${operation} failed: ${kind}`);
      throw new AiUnavailableError(`${operation}:${kind}`);
    }
  }
}
