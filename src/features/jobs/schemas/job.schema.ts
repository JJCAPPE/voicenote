import { z } from "zod";

const IdSchema = z.uuid();
const RevisionSchema = z.int().nonnegative();

export const JobPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("submit_transcription"), segmentId: IdSchema }),
  z.object({
    type: z.literal("generate_note"),
    noteId: IdSchema,
    sourceRevision: RevisionSchema,
  }),
  z.object({
    type: z.literal("index_note"),
    noteId: IdSchema,
    sourceRevision: RevisionSchema,
  }),
  z.object({ type: z.literal("extract_attachment"), attachmentId: IdSchema }),
  z.object({ type: z.literal("index_attachment"), attachmentId: IdSchema }),
]);

export const JobIdSchema = z.object({ id: z.uuid() });
