import { z } from "zod";

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

export const CreateSegmentSchema = z.object({
  noteId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z
    .string()
    .max(200)
    .refine(
      (value) => /^audio\/[a-z0-9.+-]+$/i.test(value.split(";")[0].trim()),
      "Must be an audio MIME type.",
    ),
  fileSizeBytes: z.int().positive().max(MAX_AUDIO_BYTES),
  durationSeconds: z.number().finite().nonnegative().max(24 * 60 * 60),
});

export const ConfirmSegmentSchema = z.object({
  segmentId: z.uuid(),
});

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.split(";")[0].toLowerCase();
  switch (normalized) {
    case "audio/webm":
      return "webm";
    case "audio/mp4":
    case "audio/m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "audio";
  }
}
