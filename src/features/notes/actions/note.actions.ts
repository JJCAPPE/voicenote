"use server";

import { requireSession } from "@/lib/auth/session";
import { toActionError, ValidationError } from "@/lib/errors";
import {
  CreateNoteSchema,
  NoteIdSchema,
  SaveLiveNotesSchema,
  SaveTranscriptSchema,
  UpdateNoteSchema,
} from "@/features/notes/schemas/note.schema";
import { getNoteService } from "@/server/services/factories";
import type { ActionResult, Note } from "@/types/models";

export async function listNotesAction(): Promise<ActionResult<Note[]>> {
  try {
    await requireSession();
    return { ok: true, data: await getNoteService().list() };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createNoteAction(input: unknown): Promise<ActionResult<Note>> {
  try {
    await requireSession();
    const parsed = CreateNoteSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid note.");
    return { ok: true, data: await getNoteService().create(parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createQuickRecordingNoteAction(): Promise<
  ActionResult<Note>
> {
  try {
    await requireSession();
    return { ok: true, data: await getNoteService().createQuickRecording() };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateNoteAction(input: unknown): Promise<ActionResult<Note>> {
  try {
    await requireSession();
    const parsed = UpdateNoteSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid note.");
    const { id, ...update } = parsed.data;
    return { ok: true, data: await getNoteService().update(id, update) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteNoteAction(input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = NoteIdSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid note.");
    await getNoteService().delete(parsed.data.id);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveTranscriptAction(
  input: unknown,
): Promise<ActionResult<Note>> {
  try {
    await requireSession();
    const parsed = SaveTranscriptSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Transcript cannot be blank.");
    return {
      ok: true,
      data: await getNoteService().saveEditedTranscript(
        parsed.data.id,
        parsed.data.transcript,
      ),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveLiveNotesAction(
  input: unknown,
): Promise<ActionResult<Note>> {
  try {
    await requireSession();
    const parsed = SaveLiveNotesSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Live notes are too long.");
    return {
      ok: true,
      data: await getNoteService().saveLiveNotes(
        parsed.data.id,
        parsed.data.liveNotes,
      ),
    };
  } catch (error) {
    return toActionError(error);
  }
}
