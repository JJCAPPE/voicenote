import { z } from "zod";

import { MAX_ATTACHMENT_SIZE_BYTES } from "./attachment-validation";

const attachmentIdSchema = z.string().uuid();

export const createAttachmentUploadSchema = z.object({
  noteId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_SIZE_BYTES),
});

export const confirmAttachmentUploadSchema = z.object({
  attachmentId: attachmentIdSchema,
});

export const deleteAttachmentSchema = z.object({
  attachmentId: attachmentIdSchema,
});

export const retryAttachmentSchema = z.object({
  attachmentId: attachmentIdSchema,
});

export type CreateAttachmentUploadActionInput = z.infer<
  typeof createAttachmentUploadSchema
>;
