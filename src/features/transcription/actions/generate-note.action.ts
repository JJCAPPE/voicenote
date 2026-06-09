"use server";

import { z, ZodError } from "zod";

import { requireSession } from "@/lib/auth/session";
import { toPublicError } from "@/lib/errors";
import { getAiRuntime } from "@/server/services/ai-runtime";

const GenerateNoteInputSchema = z.object({
  noteId: z.uuid(),
  sourceRevision: z.number().int().nonnegative(),
});

export type GenerateNoteActionResult =
  | { ok: true; data: { queued: true } }
  | { ok: false; error: string; code: string };

export async function generateNoteAction(
  input: unknown,
): Promise<GenerateNoteActionResult> {
  try {
    await requireSession();
    const payload = GenerateNoteInputSchema.parse(input);
    await getAiRuntime().jobService.enqueue({
      type: "generate_note",
      ...payload,
    });
    return { ok: true, data: { queued: true } };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "The generation request is invalid.",
        code: "VALIDATION_ERROR",
      };
    }
    return { ok: false, ...toPublicError(error) };
  }
}
