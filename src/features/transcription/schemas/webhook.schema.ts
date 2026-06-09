import { z } from "zod";

export const AssemblyAIWebhookSchema = z.object({
  transcript_id: z.string().min(1),
  status: z.enum(["completed", "error"]),
});
