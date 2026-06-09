import { GeminiEmbeddingProvider } from "@/lib/ai/gemini-embedding.provider";
import { GeminiLLMProvider } from "@/lib/ai/gemini-llm.provider";
import { getServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AiSourceRepository } from "@/server/repositories/ai-source.repository";
import { ChatMessageRepository } from "@/server/repositories/chat-message.repository";
import { ChunkRepository } from "@/server/repositories/chunk.repository";
import { GeneratedOutputRepository } from "@/server/repositories/generated-output.repository";
import { ChatService } from "@/server/services/chat.service";
import { getJobService } from "@/server/services/factories";
import { GenerationService } from "@/server/services/generation.service";
import { IndexingService } from "@/server/services/indexing.service";
import { SearchService } from "@/server/services/search.service";

export type AiRuntime = ReturnType<typeof buildAiRuntime>;

let runtime: AiRuntime | undefined;

export function getAiRuntime(): AiRuntime {
  runtime ??= buildAiRuntime();
  return runtime;
}

function buildAiRuntime() {
  const env = getServerEnv();
  const database = getSupabaseAdmin();
  const llm = new GeminiLLMProvider(env.GEMINI_API_KEY);
  const embeddings = new GeminiEmbeddingProvider(env.GEMINI_API_KEY);
  const sourceRepository = new AiSourceRepository(database);
  const chunkRepository = new ChunkRepository(database);
  const jobService = getJobService();

  return {
    jobService,
    generationService: new GenerationService(
      sourceRepository,
      new GeneratedOutputRepository(database),
      jobService,
      llm,
    ),
    indexingService: new IndexingService(
      sourceRepository,
      chunkRepository,
      embeddings,
    ),
    searchService: new SearchService(chunkRepository, embeddings),
    chatService: new ChatService(
      new ChatMessageRepository(database),
      chunkRepository,
      embeddings,
      llm,
    ),
  };
}
