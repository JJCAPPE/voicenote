import { z } from "zod";

export const CleanupOutputSchema = z.object({
  cleanedTranscript: z.string().trim().min(1),
  topics: z.array(z.string().trim().min(1)),
  possibleErrors: z.array(z.string().trim().min(1)),
  technicalTerms: z.array(z.string().trim().min(1)),
});

export const ActionItemSchema = z.object({
  task: z.string().trim().min(1),
  owner: z.string().trim().min(1).nullable(),
  dueDate: z.string().trim().min(1).nullable(),
  sourceSegmentIds: z.array(z.string().trim().min(1)),
});

export const DecisionSchema = z.object({
  decision: z.string().trim().min(1),
  sourceSegmentIds: z.array(z.string().trim().min(1)),
});

export const SummaryOutputSchema = z.object({
  suggestedTitle: z.string().trim().min(1).max(80),
  suggestedDescription: z.string().trim().min(1).max(240),
  shortSummary: z.string().trim().min(1),
  longSummary: z.string().trim().min(1),
  markdownNotes: z.string().trim().min(1),
  actionItems: z.array(ActionItemSchema),
  decisions: z.array(DecisionSchema),
  topics: z.array(z.string().trim().min(1)),
});

export const CitationSchema = z.object({
  chunkId: z.string().trim().min(1),
  quote: z.string().trim().min(1).max(600),
});

export const QAOutputSchema = z
  .object({
    answer: z.string().trim().min(1),
    insufficientContext: z.boolean(),
    citations: z.array(CitationSchema),
  })
  .superRefine((value, context) => {
    if (value.insufficientContext && value.citations.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Insufficient-context answers cannot include citations.",
        path: ["citations"],
      });
    }
  });

export type CleanupOutput = z.infer<typeof CleanupOutputSchema>;
export type SummaryOutput = z.infer<typeof SummaryOutputSchema>;
export type QAOutput = z.infer<typeof QAOutputSchema>;

export type CleanupInput = {
  transcript: string;
};

export type SummarySegment = {
  id: string;
  label: string;
};

export type SummaryInput = {
  cleanedTranscript: string;
  liveNotes: string;
  segments: SummarySegment[];
};

export type QAContextChunk = {
  id: string;
  content: string;
  sourceLabel: string;
};

export type QAInput = {
  question: string;
  chunks: QAContextChunk[];
};

export interface LLMProvider {
  readonly model: string;
  cleanTranscript(input: CleanupInput): Promise<CleanupOutput>;
  summarizeNote(input: SummaryInput): Promise<SummaryOutput>;
  answerQuestion(input: QAInput): Promise<QAOutput>;
}
