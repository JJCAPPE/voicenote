import {
  EMBEDDING_DIMENSION,
  type EmbeddingProvider,
  isValidEmbedding,
} from "@/lib/ai/embedding.provider";
import { ProviderError } from "@/lib/errors";

export const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

type Fetch = typeof fetch;

type GeminiEmbeddingResponse = {
  embeddings?: Array<{ values?: number[] }>;
};

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  public readonly dimension = EMBEDDING_DIMENSION;

  constructor(
    private readonly apiKey: string,
    public readonly model = DEFAULT_GEMINI_EMBEDDING_MODEL,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts, "RETRIEVAL_DOCUMENT");
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text], "RETRIEVAL_QUERY");
    return embedding;
  }

  private async embed(
    texts: string[],
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requests: texts.map((text) => ({
              model: `models/${this.model}`,
              content: { parts: [{ text }] },
              taskType,
              outputDimensionality: this.dimension,
            })),
          }),
        },
      );
    } catch (error) {
      throw new ProviderError("Gemini embeddings could not be reached.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ProviderError("Gemini rejected the embedding request.");
    }

    let body: GeminiEmbeddingResponse;
    try {
      body = (await response.json()) as GeminiEmbeddingResponse;
    } catch (error) {
      throw new ProviderError("Gemini returned unreadable embeddings.", {
        cause: error,
      });
    }

    const embeddings = body.embeddings?.map((embedding) => embedding.values ?? []);
    if (
      !embeddings ||
      embeddings.length !== texts.length ||
      embeddings.some((embedding) => !isValidEmbedding(embedding, this.dimension))
    ) {
      throw new ProviderError(
        `Gemini embeddings must contain exactly ${this.dimension} finite numbers.`,
      );
    }

    return embeddings;
  }
}
