import {
  EMBEDDING_DIMENSION,
  type EmbeddingProvider,
  isValidEmbedding,
} from "@/lib/ai/embedding.provider";
import { ProviderError } from "@/lib/errors";
import type { ChunkRepository } from "@/server/repositories/chunk.repository";
import {
  SearchRequestSchema,
  type SearchRequest,
} from "@/features/search/search.schemas";
import type { SearchResult } from "@/features/search/search.types";

export class SearchService {
  constructor(
    private readonly chunkRepository: Pick<ChunkRepository, "match">,
    private readonly embeddings: EmbeddingProvider,
  ) {}

  async search(
    query: string,
    options: { noteId?: string; limit?: number } = {},
  ): Promise<SearchResult[]> {
    const input: SearchRequest = SearchRequestSchema.parse({
      query,
      ...options,
    });
    const embedding = await this.embeddings.embedQuery(input.query);
    if (!isValidEmbedding(embedding, EMBEDDING_DIMENSION)) {
      throw new ProviderError(
        `Query embeddings must contain exactly ${EMBEDDING_DIMENSION} finite numbers.`,
      );
    }
    const matches = await this.chunkRepository.match(embedding, {
      noteId: input.noteId,
      limit: input.limit,
    });

    return matches.map((match) => ({
      chunkId: match.id,
      noteId: match.noteId,
      noteTitle: match.noteTitle,
      sourceType: match.sourceType,
      sourceId: match.sourceId,
      sourceLabel:
        match.sourceType === "attachment"
          ? String(match.metadata.filename ?? "Attachment")
          : "Transcript",
      excerpt: match.content,
      metadata: match.metadata,
      similarity: match.similarity,
    }));
  }
}
