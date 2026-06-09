import { describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider } from "@/lib/ai/embedding.provider";
import type { LLMProvider } from "@/lib/ai/llm.provider";
import { ProviderError } from "@/lib/errors";
import { ChatService } from "@/server/services/chat.service";
import { SearchService } from "@/server/services/search.service";

const embeddings: EmbeddingProvider = {
  model: "embedding",
  dimension: 768,
  embedDocuments: vi.fn(),
  embedQuery: vi.fn(async () => Array(768).fill(0.1)),
};

const chunk = {
  id: "chunk-1",
  noteId: "11111111-1111-4111-8111-111111111111",
  noteTitle: "Lecture",
  sourceType: "transcript" as const,
  sourceId: "11111111-1111-4111-8111-111111111111",
  content: "The project uses PostgreSQL vector search.",
  metadata: {},
  similarity: 0.91,
};

function llm(answer: {
  answer: string;
  insufficientContext: boolean;
  citations: Array<{ chunkId: string; quote: string }>;
}): LLMProvider {
  return {
    model: "llm",
    cleanTranscript: vi.fn(),
    summarizeNote: vi.fn(),
    answerQuestion: vi.fn(async () => answer),
  };
}

function chatRepository() {
  let index = 0;
  return {
    create: vi.fn(async (input) => ({
      id: `message-${++index}`,
      noteId: input.noteId,
      role: input.role,
      content: input.content,
      citations: input.citations ?? [],
      createdAt: new Date("2026-06-09T12:00:00Z"),
    })),
  };
}

describe("SearchService", () => {
  it("validates, filters, and maps source-labelled results", async () => {
    const repository = { match: vi.fn(async () => [chunk]) };
    const service = new SearchService(repository, embeddings);

    const results = await service.search("postgres", {
      noteId: chunk.noteId,
      limit: 4,
    });

    expect(repository.match).toHaveBeenCalledWith(expect.any(Array), {
      noteId: chunk.noteId,
      limit: 4,
    });
    expect(results[0]).toEqual(
      expect.objectContaining({
        chunkId: "chunk-1",
        sourceLabel: "Transcript",
        similarity: 0.91,
      }),
    );
  });

  it("rejects invalid query lengths and limits", async () => {
    const service = new SearchService({ match: vi.fn() }, embeddings);

    await expect(service.search("x")).rejects.toThrow();
    await expect(service.search("valid", { limit: 21 })).rejects.toThrow();
  });
});

describe("ChatService", () => {
  it("persists an explicit insufficient-context answer when no chunks exist", async () => {
    const messages = chatRepository();
    const provider = llm({
      answer: "unused",
      insufficientContext: false,
      citations: [],
    });
    const service = new ChatService(
      messages,
      { match: vi.fn(async () => []) },
      embeddings,
      provider,
    );

    const result = await service.ask(chunk.noteId, "What happened?");

    expect(result.insufficientContext).toBe(true);
    expect(result.sources).toEqual([]);
    expect(messages.create).toHaveBeenCalledTimes(2);
    expect(provider.answerQuestion).not.toHaveBeenCalled();
  });

  it("rejects unknown citation IDs and non-source quotes", async () => {
    const unknown = new ChatService(
      chatRepository(),
      { match: vi.fn(async () => [chunk]) },
      embeddings,
      llm({
        answer: "Answer",
        insufficientContext: false,
        citations: [{ chunkId: "other", quote: "PostgreSQL" }],
      }),
    );
    const wrongQuote = new ChatService(
      chatRepository(),
      { match: vi.fn(async () => [chunk]) },
      embeddings,
      llm({
        answer: "Answer",
        insufficientContext: false,
        citations: [{ chunkId: "chunk-1", quote: "Redis" }],
      }),
    );

    await expect(unknown.ask(chunk.noteId, "Question?")).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(
      wrongQuote.ask(chunk.noteId, "Question?"),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("persists a valid answer and returns source display data", async () => {
    const messages = chatRepository();
    const service = new ChatService(
      messages,
      { match: vi.fn(async () => [chunk]) },
      embeddings,
      llm({
        answer: "It uses PostgreSQL.",
        insufficientContext: false,
        citations: [
          {
            chunkId: "chunk-1",
            quote: "uses   PostgreSQL vector search",
          },
        ],
      }),
    );

    const result = await service.ask(chunk.noteId, "Which database?");

    expect(result.assistantMessage.citations).toHaveLength(1);
    expect(result.sources[0]).toEqual(
      expect.objectContaining({
        chunkId: "chunk-1",
        sourceLabel: "Transcript",
      }),
    );
    expect(messages.create).toHaveBeenCalledTimes(2);
  });

  it("replaces model text when retrieved context is still insufficient", async () => {
    const messages = chatRepository();
    const service = new ChatService(
      messages,
      { match: vi.fn(async () => [chunk]) },
      embeddings,
      llm({
        answer: "Outside-knowledge speculation",
        insufficientContext: true,
        citations: [],
      }),
    );

    const result = await service.ask(chunk.noteId, "What is missing?");

    expect(result.insufficientContext).toBe(true);
    expect(result.assistantMessage.content).toBe(
      "I do not have enough indexed context in this note to answer that question.",
    );
    expect(result.assistantMessage.content).not.toContain("speculation");
  });
});
