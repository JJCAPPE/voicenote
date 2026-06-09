export const EMBEDDING_DIMENSION = 768;

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export function isValidEmbedding(
  vector: number[],
  dimension = EMBEDDING_DIMENSION,
): boolean {
  return (
    vector.length === dimension &&
    vector.every((value) => Number.isFinite(value))
  );
}
