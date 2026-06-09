import { z } from "zod";

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  noteId: z.uuid().optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
