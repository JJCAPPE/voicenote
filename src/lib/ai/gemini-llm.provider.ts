import { ProviderError } from "@/lib/errors";
import type { ZodType } from "zod";
import {
  CleanupOutputSchema,
  type CleanupInput,
  type CleanupOutput,
  type LLMProvider,
  QAOutputSchema,
  type QAInput,
  type QAOutput,
  SummaryOutputSchema,
  type SummaryInput,
  type SummaryOutput,
} from "@/lib/ai/llm.provider";
import { buildAnswerQuestionPrompt } from "@/server/prompts/answer-question.v1";
import { buildCleanTranscriptPrompt } from "@/server/prompts/clean-transcript.v1";
import { buildSummarizeNotePrompt } from "@/server/prompts/summarize-note.v1";

export const DEFAULT_GEMINI_GENERATION_MODEL = "gemini-2.5-flash";

type Fetch = typeof fetch;

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

export class GeminiLLMProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    public readonly model = DEFAULT_GEMINI_GENERATION_MODEL,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async cleanTranscript(input: CleanupInput): Promise<CleanupOutput> {
    return this.parseOutput(
      CleanupOutputSchema,
      await this.generateJson(buildCleanTranscriptPrompt(input)),
    );
  }

  async summarizeNote(input: SummaryInput): Promise<SummaryOutput> {
    return this.parseOutput(
      SummaryOutputSchema,
      await this.generateJson(buildSummarizeNotePrompt(input)),
    );
  }

  async answerQuestion(input: QAInput): Promise<QAOutput> {
    return this.parseOutput(
      QAOutputSchema,
      await this.generateJson(buildAnswerQuestionPrompt(input)),
    );
  }

  private parseOutput<T>(schema: ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ProviderError("Gemini returned invalid structured output.", {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  private async generateJson(prompt: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        },
      );
    } catch (error) {
      throw new ProviderError("Gemini could not be reached.", { cause: error });
    }

    if (!response.ok) {
      throw new ProviderError("Gemini rejected the request.");
    }

    let body: GeminiResponse;
    try {
      body = (await response.json()) as GeminiResponse;
    } catch (error) {
      throw new ProviderError("Gemini returned an unreadable response.", {
        cause: error,
      });
    }

    const candidate = body.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (
      body.promptFeedback?.blockReason ||
      (finishReason &&
        !["STOP", "MAX_TOKENS"].includes(finishReason.toUpperCase()))
    ) {
      throw new ProviderError("Gemini refused to produce the requested output.");
    }

    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new ProviderError("Gemini returned an empty response.");
    }

    try {
      return JSON.parse(stripJsonFence(text));
    } catch (error) {
      throw new ProviderError("Gemini returned malformed JSON.", {
        cause: error,
      });
    }
  }
}

function stripJsonFence(value: string): string {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ?? value;
}
