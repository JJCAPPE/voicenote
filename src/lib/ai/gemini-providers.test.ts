import { describe, expect, it, vi } from "vitest";

import { GeminiEmbeddingProvider } from "@/lib/ai/gemini-embedding.provider";
import { GeminiLLMProvider } from "@/lib/ai/gemini-llm.provider";
import { ProviderError } from "@/lib/errors";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GeminiLLMProvider", () => {
  it("rejects malformed JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "{not-json" }] },
          },
        ],
      }),
    );
    const provider = new GeminiLLMProvider("key", undefined, fetchImpl);

    await expect(
      provider.cleanTranscript({ transcript: "raw" }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("rejects schema-invalid and refused output", async () => {
    const invalid = vi.fn(async () =>
      jsonResponse({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify({ wrong: true }) }] },
          },
        ],
      }),
    );
    const refused = vi.fn(async () =>
      jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }),
    );

    await expect(
      new GeminiLLMProvider("key", undefined, invalid).cleanTranscript({
        transcript: "raw",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
    await expect(
      new GeminiLLMProvider("key", undefined, refused).cleanTranscript({
        transcript: "raw",
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("GeminiEmbeddingProvider", () => {
  it("uses distinct document and query task types", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        requests: Array<{ taskType: string }>;
      };
      return jsonResponse({
        embeddings: body.requests.map(() => ({ values: Array(768).fill(0.1) })),
      });
    });
    const provider = new GeminiEmbeddingProvider("key", undefined, fetchImpl);

    await provider.embedDocuments(["one", "two"]);
    await provider.embedQuery("query");

    const documentBody = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body),
    ) as { requests: Array<{ taskType: string }> };
    const queryBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as {
      requests: Array<{ taskType: string }>;
    };
    expect(documentBody.requests.map((request) => request.taskType)).toEqual([
      "RETRIEVAL_DOCUMENT",
      "RETRIEVAL_DOCUMENT",
    ]);
    expect(queryBody.requests[0]?.taskType).toBe("RETRIEVAL_QUERY");
  });

  it("enforces 768 finite dimensions", async () => {
    const wrongSize = vi.fn(async () =>
      jsonResponse({ embeddings: [{ values: Array(767).fill(0.1) }] }),
    );
    const nonFinite = vi.fn(async () =>
      jsonResponse({
        embeddings: [{ values: [...Array(767).fill(0.1), null] }],
      }),
    );

    await expect(
      new GeminiEmbeddingProvider("key", undefined, wrongSize).embedQuery("q"),
    ).rejects.toBeInstanceOf(ProviderError);
    await expect(
      new GeminiEmbeddingProvider("key", undefined, nonFinite).embedQuery("q"),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
