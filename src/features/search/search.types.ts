import type { ChunkSourceType } from "@/server/repositories/chunk.repository";

export type SearchResult = {
  chunkId: string;
  noteId: string;
  noteTitle: string;
  sourceType: ChunkSourceType;
  sourceId: string;
  sourceLabel: string;
  excerpt: string;
  metadata: Record<string, unknown>;
  similarity: number;
};
