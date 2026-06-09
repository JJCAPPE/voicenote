import { z } from "zod";

import { getAiRuntime } from "@/server/services/ai-runtime";

const GenerateNoteJobSchema = z.object({
  noteId: z.uuid(),
  sourceRevision: z.number().int().nonnegative(),
});

const IndexNoteJobSchema = z.object({
  noteId: z.uuid(),
  sourceRevision: z.number().int().nonnegative(),
});

const IndexAttachmentJobSchema = z.object({
  attachmentId: z.uuid(),
});

export async function handleGenerateNoteJob(payload: unknown) {
  const input = GenerateNoteJobSchema.parse(payload);
  return getAiRuntime().generationService.generateNote(
    input.noteId,
    input.sourceRevision,
  );
}

export async function handleIndexNoteJob(payload: unknown) {
  const input = IndexNoteJobSchema.parse(payload);
  return getAiRuntime().indexingService.indexNote(
    input.noteId,
    input.sourceRevision,
  );
}

export async function handleIndexAttachmentJob(payload: unknown) {
  const input = IndexAttachmentJobSchema.parse(payload);
  return getAiRuntime().indexingService.indexAttachment(input.attachmentId);
}
