import { describe, expect, it } from "vitest";

import {
  CleanupOutputSchema,
  QAOutputSchema,
  SummaryOutputSchema,
} from "@/lib/ai/llm.provider";
import {
  ANSWER_QUESTION_PROMPT_VERSION,
  buildAnswerQuestionPrompt,
} from "@/server/prompts/answer-question.v1";
import {
  CLEAN_TRANSCRIPT_PROMPT_VERSION,
  buildCleanTranscriptPrompt,
} from "@/server/prompts/clean-transcript.v1";
import {
  SUMMARIZE_NOTE_PROMPT_VERSION,
  buildSummarizeNotePrompt,
} from "@/server/prompts/summarize-note.v2";

describe("versioned AI prompts", () => {
  it("exports stable prompt versions", () => {
    expect(CLEAN_TRANSCRIPT_PROMPT_VERSION).toBe("clean-transcript.v1");
    expect(SUMMARIZE_NOTE_PROMPT_VERSION).toBe("summarize-note.v2");
    expect(ANSWER_QUESTION_PROMPT_VERSION).toBe("answer-question.v1");
  });

  it("instructs cleanup to preserve meaning without summarizing", () => {
    const prompt = buildCleanTranscriptPrompt({ transcript: "raw text" });

    expect(prompt).toContain("without summarizing");
    expect(prompt).toContain("Do not invent facts");
    expect(prompt).toContain("raw text");
  });

  it("restricts summaries and answers to supplied evidence", () => {
    const summary = buildSummarizeNotePrompt({
      cleanedTranscript: "clean",
      liveNotes: "Owner is Morgan",
      segments: [{ id: "segment-1", label: "First" }],
    });
    const answer = buildAnswerQuestionPrompt({
      question: "What happened?",
      chunks: [{ id: "chunk-1", content: "Evidence", sourceLabel: "Transcript" }],
    });

    expect(summary).toContain("Do not invent facts");
    expect(summary).toContain("segment-1");
    expect(summary).toContain("Owner is Morgan");
    expect(answer).toContain("Never use outside knowledge");
    expect(answer).toContain("insufficientContext");
    expect(answer).toContain('id="chunk-1"');
  });
});

describe("structured output schemas", () => {
  it("validates cleanup and summary output", () => {
    expect(
      CleanupOutputSchema.parse({
        cleanedTranscript: "Clean",
        topics: [],
        possibleErrors: [],
        technicalTerms: [],
      }).cleanedTranscript,
    ).toBe("Clean");

    expect(
      SummaryOutputSchema.parse({
        suggestedTitle: "Launch review",
        suggestedDescription: "A review of the launch plan.",
        shortSummary: "Short",
        longSummary: "Long",
        markdownNotes: "# Notes",
        actionItems: [],
        decisions: [],
        topics: [],
      }).markdownNotes,
    ).toBe("# Notes");
  });

  it("rejects citations on insufficient-context answers", () => {
    expect(() =>
      QAOutputSchema.parse({
        answer: "Not enough context.",
        insufficientContext: true,
        citations: [{ chunkId: "chunk-1", quote: "quote" }],
      }),
    ).toThrow();
  });
});
