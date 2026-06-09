import { describe, expect, it, vi } from "vitest";
import { handleAssemblyAIWebhook } from "@/features/transcription/server/assemblyai-webhook";
import type { TranscriptionService } from "@/server/services/transcription.service";

describe("AssemblyAI webhook", () => {
  it("rejects an invalid secret before processing the body", async () => {
    const service = { handleCompletedCallback: vi.fn() };
    const response = await handleAssemblyAIWebhook(
      new Request("https://app.example/api/webhooks/assemblyai", {
        method: "POST",
        headers: { "x-assemblyai-webhook-secret": "wrong" },
        body: JSON.stringify({ transcript_id: "external-1", status: "completed" }),
      }),
      service as unknown as TranscriptionService,
      "correct",
    );
    expect(response.status).toBe(401);
    expect(service.handleCompletedCallback).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await handleAssemblyAIWebhook(
      new Request("https://app.example/api/webhooks/assemblyai", {
        method: "POST",
        headers: { "x-assemblyai-webhook-secret": "correct" },
        body: JSON.stringify({ status: "completed" }),
      }),
      { handleCompletedCallback: vi.fn() } as unknown as TranscriptionService,
      "correct",
    );
    expect(response.status).toBe(400);
  });

  it("returns success for duplicate delivery", async () => {
    const service = {
      handleCompletedCallback: vi.fn(async () => ({
        status: "duplicate",
        segment: {},
      })),
    };
    const response = await handleAssemblyAIWebhook(
      new Request("https://app.example/api/webhooks/assemblyai", {
        method: "POST",
        headers: { "x-assemblyai-webhook-secret": "correct" },
        body: JSON.stringify({ transcript_id: "external-1", status: "completed" }),
      }),
      service as unknown as TranscriptionService,
      "correct",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "duplicate",
    });
  });
});
