import { z } from "zod";
import { ProviderError, TranscriptionPendingError } from "@/lib/errors";
import type {
  RawTranscript,
  SubmitAudioInput,
  TranscriptUtterance,
  TranscriptWord,
  TranscriptionProvider,
} from "@/lib/ai/transcription.provider";

const SubmitResponseSchema = z.object({ id: z.string().min(1) });
const WordSchema = z.object({
  text: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  speaker: z.string().nullable().optional(),
});
const UtteranceSchema = z.object({
  text: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  speaker: z.string(),
  words: z.array(WordSchema).default([]),
});
const TranscriptResponseSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "error"]),
  text: z.string().nullable().optional(),
  language_code: z.string().nullable().optional(),
  audio_duration: z.number().nullable().optional(),
  utterances: z.array(UtteranceSchema).nullable().optional(),
  words: z.array(WordSchema).nullable().optional(),
  error: z.string().nullable().optional(),
});

export function normalizeTranscriptText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function normalizeWord(word: z.infer<typeof WordSchema>): TranscriptWord {
  return {
    text: normalizeTranscriptText(word.text),
    start: word.start,
    end: word.end,
    confidence: word.confidence,
    speaker: word.speaker ?? null,
  };
}

function normalizeUtterance(
  utterance: z.infer<typeof UtteranceSchema>,
): TranscriptUtterance {
  return {
    text: normalizeTranscriptText(utterance.text),
    start: utterance.start,
    end: utterance.end,
    confidence: utterance.confidence,
    speaker: utterance.speaker,
    words: utterance.words.map(normalizeWord),
  };
}

export class AssemblyAITranscriptionProvider implements TranscriptionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async submitAudio(
    input: SubmitAudioInput,
  ): Promise<{ externalJobId: string }> {
    const response = await this.fetchImpl("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: input.audioUrl,
        speech_models: ["universal-3-pro"],
        language_detection: true,
        speaker_labels: true,
        webhook_url: input.webhookUrl,
        webhook_auth_header_name: "x-assemblyai-webhook-secret",
        webhook_auth_header_value: input.webhookSecret,
      }),
    });
    if (!response.ok) throw new ProviderError();

    const parsed = SubmitResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new ProviderError("Invalid provider response.");
    return { externalJobId: parsed.data.id };
  }

  async getTranscript(externalJobId: string): Promise<RawTranscript> {
    const response = await this.fetchImpl(
      `https://api.assemblyai.com/v2/transcript/${encodeURIComponent(externalJobId)}`,
      { headers: { authorization: this.apiKey } },
    );
    if (!response.ok) throw new ProviderError();

    const raw: unknown = await response.json();
    const parsed = TranscriptResponseSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError("Invalid provider transcript.");
    if (parsed.data.status === "error") {
      throw new ProviderError("Transcription failed.");
    }
    if (
      parsed.data.status === "queued" ||
      parsed.data.status === "processing"
    ) {
      throw new TranscriptionPendingError();
    }
    if (!parsed.data.text?.trim()) {
      throw new ProviderError("Transcription result is empty.");
    }

    return {
      text: normalizeTranscriptText(parsed.data.text),
      language: parsed.data.language_code ?? null,
      durationSeconds: parsed.data.audio_duration ?? null,
      utterances: (parsed.data.utterances ?? []).map(normalizeUtterance),
      words: (parsed.data.words ?? []).map(normalizeWord),
      providerPayload: raw,
    };
  }
}
