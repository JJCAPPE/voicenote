import { describe, expect, it, vi } from "vitest";

import type { EmbeddingProvider } from "@/lib/ai/embedding.provider";
import { ProviderError } from "@/lib/errors";
import type { ReplaceChunksInput } from "@/server/repositories/chunk.repository";
import { IndexingService } from "@/server/services/indexing.service";

function embeddingProvider(dimension = 768): EmbeddingProvider {
  return {
    model: "gemini-embedding-001",
    dimension: 768,
    embedDocuments: vi.fn(async (texts: string[]) =>
      texts.map(() => Array(dimension).fill(0.1)),
    ),
    embedQuery: vi.fn(),
  };
}

describe("IndexingService", () => {
  it("does nothing for stale note revisions", async () => {
    const chunks = { replaceSource: vi.fn() };
    const embeddings = embeddingProvider();
    const service = new IndexingService(
      {
        getTranscriptIndexSource: vi.fn(async () => ({
          noteId: "note-1",
          sourceRevision: 2,
          transcript: "Text",
        })),
        getAttachmentIndexSource: vi.fn(),
      },
      chunks,
      embeddings,
    );

    await expect(service.indexNote("note-1", 1)).resolves.toBe("stale");
    expect(embeddings.embedDocuments).not.toHaveBeenCalled();
    expect(chunks.replaceSource).not.toHaveBeenCalled();
  });

  it("replaces only the transcript source and forwards the revision guard", async () => {
    const chunks = { replaceSource: vi.fn(async () => true) };
    const service = new IndexingService(
      {
        getTranscriptIndexSource: vi.fn(async () => ({
          noteId: "note-1",
          sourceRevision: 4,
          transcript: "Transcript content",
        })),
        getAttachmentIndexSource: vi.fn(),
      },
      chunks,
      embeddingProvider(),
    );

    await expect(service.indexNote("note-1", 4)).resolves.toBe("indexed");
    expect(chunks.replaceSource).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: "note-1",
        sourceType: "transcript",
        sourceId: "note-1",
        sourceRevision: 4,
      }),
    );
  });

  it("preserves attachment filename and extraction metadata", async () => {
    let write: ReplaceChunksInput | undefined;
    const chunks = {
      replaceSource: vi.fn(async (input: ReplaceChunksInput) => {
        write = input;
        return true;
      }),
    };
    const service = new IndexingService(
      {
        getTranscriptIndexSource: vi.fn(),
        getAttachmentIndexSource: vi.fn(async () => ({
          attachmentId: "attachment-1",
          noteId: "note-1",
          filename: "reference.pdf",
          text: "Attachment content",
          metadata: { pageCount: 2 },
        })),
      },
      chunks,
      embeddingProvider(),
    );

    await service.indexAttachment("attachment-1");
    expect(write).toBeDefined();
    if (!write) {
      throw new Error("Expected attachment chunk replacement.");
    }
    expect(write.sourceType).toBe("attachment");
    expect(write.sourceId).toBe("attachment-1");
    expect(write.chunks[0]?.metadata).toEqual(
      expect.objectContaining({ filename: "reference.pdf", pageCount: 2 }),
    );
  });

  it("rejects invalid provider dimensions before replacement", async () => {
    const chunks = { replaceSource: vi.fn() };
    const service = new IndexingService(
      {
        getTranscriptIndexSource: vi.fn(async () => ({
          noteId: "note-1",
          sourceRevision: 1,
          transcript: "Transcript",
        })),
        getAttachmentIndexSource: vi.fn(),
      },
      chunks,
      embeddingProvider(10),
    );

    await expect(service.indexNote("note-1", 1)).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(chunks.replaceSource).not.toHaveBeenCalled();
  });
});
