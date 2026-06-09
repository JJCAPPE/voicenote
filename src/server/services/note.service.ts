import { NotFoundError, ValidationError } from "@/lib/errors";
import { SaveTranscriptSchema } from "@/features/notes/schemas/note.schema";
import type {
  CreateNoteInput,
  NoteRepository,
  UpdateNoteInput,
} from "@/server/repositories/note.repository";
import type { JobService } from "@/server/services/job.service";
import type { Note, NoteDetail } from "@/types/models";

export interface NoteStorageCleanup {
  removeAudio(paths: string[]): Promise<void>;
  removeAttachments(paths: string[]): Promise<void>;
}

export class NoteService {
  constructor(
    private readonly repository: NoteRepository,
    private readonly jobs: JobService,
    private readonly storage?: NoteStorageCleanup,
  ) {}

  list(): Promise<Note[]> {
    return this.repository.list();
  }

  async get(noteId: string): Promise<NoteDetail> {
    const note = await this.repository.findById(noteId);
    if (!note) throw new NotFoundError("Note not found.");
    return note;
  }

  create(input: CreateNoteInput): Promise<Note> {
    return this.repository.create(input);
  }

  update(id: string, input: UpdateNoteInput): Promise<Note> {
    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<void> {
    if (this.storage) {
      const note = await this.get(id);
      await this.storage.removeAudio(
        note.segments
          .filter((segment) => !segment.audioDeleted)
          .map((segment) => segment.storagePath),
      );
      await this.storage.removeAttachments(
        note.attachments.map((attachment) => attachment.storagePath),
      );
    }
    await this.repository.delete(id);
  }

  getActiveTranscript(noteId: string): Promise<string> {
    return this.repository.getActiveTranscript(noteId);
  }

  async saveEditedTranscript(noteId: string, transcript: string): Promise<Note> {
    const parsed = SaveTranscriptSchema.safeParse({ id: noteId, transcript });
    if (!parsed.success) {
      throw new ValidationError("Transcript cannot be blank.");
    }

    const note = await this.repository.saveEditedTranscript(
      parsed.data.id,
      parsed.data.transcript,
    );
    await this.jobs.enqueue({
      type: "index_note",
      noteId: note.id,
      sourceRevision: note.transcriptRevision,
    });
    return note;
  }

  rebuildRawCombinedTranscript(noteId: string): Promise<Note> {
    return this.repository.rebuildRawCombinedTranscript(noteId);
  }
}
