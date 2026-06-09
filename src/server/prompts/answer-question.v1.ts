import type { QAInput } from "@/lib/ai/llm.provider";

export const ANSWER_QUESTION_PROMPT_VERSION = "answer-question.v1";

export function buildAnswerQuestionPrompt(input: QAInput): string {
  const context = input.chunks
    .map(
      (chunk) =>
        `<chunk id="${chunk.id}" source="${chunk.sourceLabel}">\n${chunk.content}\n</chunk>`,
    )
    .join("\n\n");

  return `Answer the question using only the supplied chunks.

Rules:
- Never use outside knowledge or invent facts.
- If the chunks do not contain enough evidence, set insufficientContext to true.
- Every factual answer must cite supporting chunks.
- Citation chunkId values must exactly match supplied chunk IDs.
- Each citation quote must be a short verbatim excerpt from its chunk.
- Return JSON only with these camelCase keys:
  answer, insufficientContext, citations.

Question:
${input.question}

Context:
${context}`;
}
