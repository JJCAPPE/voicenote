import {
  EMBEDDING_DIMENSION,
  type EmbeddingProvider,
  isValidEmbedding,
} from "@/lib/ai/embedding.provider";
import { NotFoundError, ProviderError, ValidationError } from "@/lib/errors";
import type {
  AiSourceRepository,
  AttachmentIndexSource,
} from "@/server/repositories/ai-source.repository";
import type {
  ChunkRepository,
  ChunkWrite,
} from "@/server/repositories/chunk.repository";
import { chunkText } from "@/server/services/chunker";

const EMBEDDING_BATCH_SIZE = 20;

export type IndexingResult = "indexed" | "stale";

export class IndexingService {
  constructor(
    private readonly sourceRepository: Pick<
      AiSourceRepository,
      "getTranscriptIndexSource" | "getAttachmentIndexSource"
    >,
    private readonly chunkRepository: Pick<ChunkRepository, "replaceSource">,
    private readonly embeddings: EmbeddingProvider,
  ) {}

  async indexNote(
    noteId: string,
    sourceRevision: number,
  ): Promise<IndexingResult> {
    const source =
      await this.sourceRepository.getTranscriptIndexSource(noteId);
    if (!source) {
      throw new NotFoundError("The note was not found.");
    }
    if (source.sourceRevision !== sourceRevision) {
      return "stale";
    }

    const chunks = chunkText(source.transcript, {
      metadata: { source: "transcript" },
    });
    if (chunks.length === 0) {
      throw new ValidationError("The note has no active transcript to index.");
    }

    const writes = await this.embedChunks(chunks);
    const replaced = await this.chunkRepository.replaceSource({
      noteId,
      sourceType: "transcript",
      sourceId: noteId,
      sourceRevision,
      chunks: writes,
    });

    return replaced ? "indexed" : "stale";
  }

  async indexAttachment(attachmentId: string): Promise<IndexingResult> {
    const source =
      await this.sourceRepository.getAttachmentIndexSource(attachmentId);
    if (!source) {
      throw new NotFoundError(
        "The completed attachment text was not found.",
      );
    }

    const chunks = attachmentChunks(source);
    if (chunks.length === 0) {
      throw new ValidationError("The attachment has no extracted text to index.");
    }

    const writes = await this.embedChunks(chunks);
    await this.chunkRepository.replaceSource({
      noteId: source.noteId,
      sourceType: "attachment",
      sourceId: source.attachmentId,
      chunks: writes,
    });
    return "indexed";
  }

  private async embedChunks(
    chunks: ReturnType<typeof chunkText>,
  ): Promise<ChunkWrite[]> {
    const vectors: number[][] = [];
    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      vectors.push(
        ...(await this.embeddings.embedDocuments(
          batch.map((chunk) => chunk.content),
        )),
      );
    }

    if (
      vectors.length !== chunks.length ||
      vectors.some(
        (vector) => !isValidEmbedding(vector, EMBEDDING_DIMENSION),
      )
    ) {
      throw new ProviderError(
        `Document embeddings must contain exactly ${EMBEDDING_DIMENSION} finite numbers.`,
      );
    }

    return chunks.map((chunk, index) => ({
      chunkIndex: chunk.index,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: vectors[index],
      embeddingModel: this.embeddings.model,
    }));
  }
}

function attachmentChunks(source: AttachmentIndexSource) {
  return chunkText(source.text, {
    metadata: {
      ...source.metadata,
      source: "attachment",
      filename: source.filename,
    },
  });
}
