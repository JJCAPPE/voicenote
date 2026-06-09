import type { SupabaseClient } from "@supabase/supabase-js";

import { StorageError } from "@/lib/errors";
import type { ChunkSourceType } from "@/types/models";

export type { ChunkSourceType } from "@/types/models";

export type ChunkWrite = {
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
  embeddingModel: string;
};

export type ReplaceChunksInput = {
  noteId: string;
  sourceType: ChunkSourceType;
  sourceId: string;
  sourceRevision?: number;
  chunks: ChunkWrite[];
};

export type MatchedChunk = {
  id: string;
  noteId: string;
  noteTitle: string;
  sourceType: ChunkSourceType;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

type MatchChunkRow = {
  chunk_id: string;
  note_id: string;
  note_title: string;
  source_type: ChunkSourceType;
  source_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export class ChunkRepository {
  constructor(private readonly database: SupabaseClient) {}

  async replaceSource(input: ReplaceChunksInput): Promise<boolean> {
    const { data, error } = await this.database.rpc("replace_source_chunks", {
      p_note_id: input.noteId,
      p_source_type: input.sourceType,
      p_source_id: input.sourceId,
      p_source_revision: input.sourceRevision ?? null,
      p_chunks: input.chunks.map((chunk) => ({
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: chunk.embedding,
        embedding_model: chunk.embeddingModel,
      })),
    });

    if (error) {
      throw new StorageError("Search chunks could not be replaced.", {
        cause: error,
      });
    }

    return data === true;
  }

  async match(
    embedding: number[],
    options: { noteId?: string; limit: number },
  ): Promise<MatchedChunk[]> {
    const { data, error } = await this.database.rpc("match_chunks", {
      query_embedding: embedding,
      filter_note_id: options.noteId ?? null,
      match_count: options.limit,
    });

    if (error) {
      throw new StorageError("Semantic search failed.", { cause: error });
    }

    return ((data ?? []) as MatchChunkRow[]).map((row) => ({
      id: row.chunk_id,
      noteId: row.note_id,
      noteTitle: row.note_title,
      sourceType: row.source_type,
      sourceId: row.source_id,
      content: row.content,
      metadata: row.metadata ?? {},
      similarity: row.similarity,
    }));
  }
}
