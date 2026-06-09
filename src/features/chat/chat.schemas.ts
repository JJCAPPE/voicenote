import { z } from "zod";

export const AskQuestionSchema = z.object({
  question: z.string().trim().min(2).max(2_000),
});

export type AskQuestionInput = z.infer<typeof AskQuestionSchema>;
