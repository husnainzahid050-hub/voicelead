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

/**
 * These are short extraction tasks: deep "thinking" only adds latency (newer
 * Flash models think by default and blew through the timeouts). Gemini 2.x
 * takes a token budget, Gemini 3+ a level.
 */
function minimalThinking(modelId: string) {
  const thinkingConfig = /^gemini-2\./.test(modelId)
    ? { thinkingBudget: 0 }
    : { thinkingLevel: "low" as const };
  return { google: { thinkingConfig } };
}

export class GeminiLeadAI implements LeadAI {
  readonly name = "gemini" as const;
  private readonly model: LanguageModel;
  private readonly providerOptions: ReturnType<typeof minimalThinking>;

  constructor(apiKey: string, modelId: string) {
    this.model = createGoogleGenerativeAI({ apiKey })(modelId);
    this.providerOptions = minimalThinking(modelId);
  }

  async transcribe(audio: Uint8Array, mediaType: string): Promise<AiTranscription> {
    return this.call("transcribe", async () => {
      const { output } = await generateText({
        ...REQUEST,
        model: this.model,
        providerOptions: this.providerOptions,
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
        providerOptions: this.providerOptions,
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
        providerOptions: this.providerOptions,
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
        providerOptions: this.providerOptions,
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
    const started = Date.now();
    try {
      const result = await fn();
      console.info(`[ai] gemini ${operation} ok in ${Date.now() - started}ms`);
      return result;
    } catch (error) {
      // Never log prompts, transcripts, keys or provider payloads.
      const kind = error instanceof Error ? error.name : "UnknownError";
      console.error(`[ai] gemini ${operation} failed: ${kind}${describeProviderError(error)}`);
      throw new AiUnavailableError(`${operation}:${kind}`);
    }
  }
}

/**
 * Safe diagnostics for provider failures: HTTP status plus Google's error
 * status code (e.g. RESOURCE_EXHAUSTED). Never the message body, which could
 * echo request content.
 */
function describeProviderError(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const e = error as { statusCode?: unknown; responseBody?: unknown; lastError?: unknown };
  if (e.lastError) return describeProviderError(e.lastError); // retry wrapper
  const parts: string[] = [];
  if (typeof e.statusCode === "number") parts.push(`http=${e.statusCode}`);
  if (typeof e.responseBody === "string") {
    try {
      const body = (
        JSON.parse(e.responseBody) as { error?: { status?: unknown; message?: unknown } }
      ).error;
      const status = body?.status;
      if (typeof status === "string" && /^[A-Z_]{3,40}$/.test(status))
        parts.push(`status=${status}`);
      // 400s describe the request parameters (model, config), not the patient's words.
      if (e.statusCode === 400 && typeof body?.message === "string") {
        parts.push(`reason="${body.message.slice(0, 160).replace(/\s+/g, " ")}"`);
      }
    } catch {
      // not JSON; ignore
    }
  }
  return parts.length ? ` (${parts.join(" ")})` : "";
}
