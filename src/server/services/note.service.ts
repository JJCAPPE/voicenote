import { NotFoundError, ValidationError } from "@/lib/errors";
import { SaveTranscriptSchema } from "@/features/notes/schemas/note.schema";
import type {
  CreateNoteInput,
  NoteRepository,
  UpdateNoteInput,
} from "@/server/repositories/note.repository";
import type { JobService } from "@/server/services/job.service";
import type { Note, NoteDetail } from "@/types/models";

export class NoteService {
  constructor(
    private readonly repository: NoteRepository,
    private readonly jobs: JobService,
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

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
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
