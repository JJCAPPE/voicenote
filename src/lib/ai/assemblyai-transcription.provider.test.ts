import { describe, expect, it, vi } from "vitest";
import { AssemblyAITranscriptionProvider } from "@/lib/ai/assemblyai-transcription.provider";
import { ProviderError, TranscriptionPendingError } from "@/lib/errors";

describe("AssemblyAITranscriptionProvider", () => {
  it("distinguishes incomplete provider work from failures", async () => {
    const provider = new AssemblyAITranscriptionProvider(
      "key",
      vi.fn(async () =>
        new Response(JSON.stringify({ status: "processing" }), {
          status: 200,
        }),
      ) as typeof fetch,
    );

    await expect(provider.getTranscript("external-1")).rejects.toBeInstanceOf(
      TranscriptionPendingError,
    );
  });

  it("submits the required model, detection, labels, and webhook auth", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({ id: "external-1" }),
    );
    const provider = new AssemblyAITranscriptionProvider(
      "api-key",
      fetchMock as typeof fetch,
    );

    await expect(
      provider.submitAudio({
        audioUrl: "https://storage.example/audio",
        webhookUrl: "https://app.example/api/webhooks/assemblyai",
        webhookSecret: "secret",
      }),
    ).resolves.toEqual({ externalJobId: "external-1" });

    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body)) as Record<string, unknown>;
    expect(body).toEqual(
      expect.objectContaining({
        speech_models: ["universal-3-pro"],
        language_detection: true,
        speaker_labels: true,
        webhook_auth_header_name: "x-assemblyai-webhook-secret",
        webhook_auth_header_value: "secret",
      }),
    );
  });

  it("normalizes authoritative transcript fields", async () => {
    const payload = {
      status: "completed",
      text: " Hello   world\r\n",
      language_code: "en",
      audio_duration: 12.5,
      utterances: [
        {
          text: " Hello ",
          start: 0,
          end: 500,
          confidence: 0.9,
          speaker: "A",
          words: [],
        },
      ],
      words: [
        {
          text: "Hello",
          start: 0,
          end: 500,
          confidence: 0.9,
          speaker: "A",
        },
      ],
    };
    const provider = new AssemblyAITranscriptionProvider(
      "api-key",
      vi.fn(async () => Response.json(payload)) as typeof fetch,
    );

    await expect(provider.getTranscript("external-1")).resolves.toEqual({
      text: "Hello world",
      language: "en",
      durationSeconds: 12.5,
      utterances: [
        {
          text: "Hello",
          start: 0,
          end: 500,
          confidence: 0.9,
          speaker: "A",
          words: [],
        },
      ],
      words: [
        {
          text: "Hello",
          start: 0,
          end: 500,
          confidence: 0.9,
          speaker: "A",
        },
      ],
      providerPayload: payload,
    });
  });

  it("rejects malformed and failed provider responses", async () => {
    const malformed = new AssemblyAITranscriptionProvider(
      "api-key",
      vi.fn(async () => Response.json({ status: "completed" })) as typeof fetch,
    );
    await expect(malformed.getTranscript("external-1")).rejects.toBeInstanceOf(
      ProviderError,
    );

    const failed = new AssemblyAITranscriptionProvider(
      "api-key",
      vi.fn(async () =>
        Response.json({ status: "error", error: "provider detail" }),
      ) as typeof fetch,
    );
    await expect(failed.getTranscript("external-1")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
