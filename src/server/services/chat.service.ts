import type { LLMProvider } from "@/lib/ai/llm.provider";
import { ProviderError } from "@/lib/errors";
import { AskQuestionSchema } from "@/features/chat/chat.schemas";
import type { AskQuestionResult, ChatSource } from "@/features/chat/chat.types";
import type { ChunkRepository } from "@/server/repositories/chunk.repository";
import type { ChatMessageRepository } from "@/server/repositories/chat-message.repository";
import {
  EMBEDDING_DIMENSION,
  type EmbeddingProvider,
  isValidEmbedding,
} from "@/lib/ai/embedding.provider";

const NO_CONTEXT_ANSWER =
  "I do not have enough indexed context in this note to answer that question.";

export class ChatService {
  constructor(
    private readonly chatRepository: Pick<ChatMessageRepository, "create">,
    private readonly chunkRepository: Pick<ChunkRepository, "match">,
    private readonly embeddings: EmbeddingProvider,
    private readonly llm: LLMProvider,
  ) {}

  async ask(noteId: string, question: string): Promise<AskQuestionResult> {
    const input = AskQuestionSchema.parse({ question });
    const userMessage = await this.chatRepository.create({
      noteId,
      role: "user",
      content: input.question,
    });

    const queryEmbedding = await this.embeddings.embedQuery(input.question);
    if (!isValidEmbedding(queryEmbedding, EMBEDDING_DIMENSION)) {
      throw new ProviderError(
        `Query embeddings must contain exactly ${EMBEDDING_DIMENSION} finite numbers.`,
      );
    }
    const chunks = await this.chunkRepository.match(queryEmbedding, {
      noteId,
      limit: 8,
    });

    if (chunks.length === 0) {
      const assistantMessage = await this.chatRepository.create({
        noteId,
        role: "assistant",
        content: NO_CONTEXT_ANSWER,
      });
      return {
        userMessage,
        assistantMessage,
        insufficientContext: true,
        sources: [],
      };
    }

    const answer = await this.llm.answerQuestion({
      question: input.question,
      chunks: chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        sourceLabel: sourceLabel(chunk),
      })),
    });
    const sources = validateCitations(answer.citations, chunks);

    if (!answer.insufficientContext && answer.citations.length === 0) {
      throw new ProviderError("Gemini answered without citing note context.");
    }

    const content = answer.insufficientContext
      ? NO_CONTEXT_ANSWER
      : answer.answer;
    const assistantMessage = await this.chatRepository.create({
      noteId,
      role: "assistant",
      content,
      citations: answer.citations,
    });

    return {
      userMessage,
      assistantMessage,
      insufficientContext: answer.insufficientContext,
      sources,
    };
  }
}

function validateCitations(
  citations: Array<{ chunkId: string; quote: string }>,
  chunks: Awaited<ReturnType<ChunkRepository["match"]>>,
): ChatSource[] {
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  return citations.map((citation) => {
    const chunk = chunksById.get(citation.chunkId);
    if (!chunk) {
      throw new ProviderError("Gemini cited a chunk outside the supplied context.");
    }

    if (!normalizeWhitespace(chunk.content).includes(normalizeWhitespace(citation.quote))) {
      throw new ProviderError("Gemini cited a quote not found in its source chunk.");
    }

    return {
      ...citation,
      sourceLabel: sourceLabel(chunk),
      excerpt: chunk.content,
    };
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sourceLabel(
  chunk: Awaited<ReturnType<ChunkRepository["match"]>>[number],
): string {
  return chunk.sourceType === "attachment"
    ? String(chunk.metadata.filename ?? "Attachment")
    : "Transcript";
}
