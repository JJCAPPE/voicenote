import { z } from "zod";

const NoteTypeSchema = z.enum([
  "meeting",
  "lecture",
  "office_hours",
  "project",
  "personal",
  "other",
]);

export const NoteIdSchema = z.object({ id: z.uuid() });
export const CreateNoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  noteType: NoteTypeSchema.default("other"),
});
export const UpdateNoteSchema = CreateNoteSchema.partial().extend({
  id: z.uuid(),
});
export const SaveTranscriptSchema = z.object({
  id: z.uuid(),
  transcript: z.string().trim().min(1),
});
export const SaveLiveNotesSchema = z.object({
  id: z.uuid(),
  liveNotes: z.string().max(100_000),
});
