import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import {
  mapAttachmentRow,
  mapChatMessageRow,
  mapGeneratedOutputRow,
  mapJobRow,
  mapNoteRow,
  mapRecordingSegmentRow,
} from "@/types/mappers";
import type {
  AttachmentRow,
  ChatMessageRow,
  GeneratedOutputRow,
  JobRow,
  Note,
  NoteDetail,
  NoteRow,
  NoteType,
  RecordingSegmentRow,
  TranscriptVersion,
} from "@/types/models";

const NOTE_COLUMNS =
  "id,title,description,note_type,raw_combined_transcript,cleaned_transcript,user_edited_transcript,active_transcript_version,transcript_revision,indexed_revision,created_at,updated_at";
const SEGMENT_COLUMNS =
  "id,note_id,segment_index,original_filename,storage_path,mime_type,file_size_bytes,duration_seconds,status,external_provider,external_job_id,raw_transcript,transcript_json,speaker_labels,audio_deleted,error_message,created_at,updated_at";

export interface CreateNoteInput {
  title: string;
  description?: string | null;
  noteType?: NoteType;
}

export interface UpdateNoteInput {
  title?: string;
  description?: string | null;
  noteType?: NoteType;
}

export function selectActiveTranscript(
  note: Pick<
    Note,
    | "activeTranscriptVersion"
    | "rawCombinedTranscript"
    | "cleanedTranscript"
    | "userEditedTranscript"
  >,
): string {
  const versions: Record<TranscriptVersion, string | null> = {
    raw: note.rawCombinedTranscript,
    cleaned: note.cleanedTranscript,
    user_edited: note.userEditedTranscript,
  };
  return versions[note.activeTranscriptVersion] ?? "";
}

export function formatCombinedTranscript(
  segments: Array<{ segmentIndex: number; rawTranscript: string | null }>,
): string {
  return segments
    .filter((segment) => segment.rawTranscript?.trim())
    .sort((a, b) => a.segmentIndex - b.segmentIndex)
    .map(
      (segment) =>
        `## Segment ${segment.segmentIndex}\n\n${segment.rawTranscript!.trim()}`,
    )
    .join("\n\n");
}

export class NoteRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Note[]> {
    const { data, error } = await this.client
      .from("notes")
      .select(NOTE_COLUMNS)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as NoteRow[]).map(mapNoteRow);
  }

  async findById(id: string): Promise<NoteDetail | null> {
    const [
      noteResult,
      segmentResult,
      attachmentResult,
      outputResult,
      chatResult,
      jobResult,
    ] = await Promise.all([
      this.client.from("notes").select(NOTE_COLUMNS).eq("id", id).maybeSingle(),
      this.client
        .from("recording_segments")
        .select(SEGMENT_COLUMNS)
        .eq("note_id", id)
        .order("segment_index"),
      this.client
        .from("attachments")
        .select("*")
        .eq("note_id", id)
        .order("created_at"),
      this.client
        .from("generated_outputs")
        .select("*")
        .eq("note_id", id)
        .order("created_at"),
      this.client
        .from("chat_messages")
        .select("id,note_id,role,content,citations,created_at")
        .eq("note_id", id)
        .order("created_at"),
      this.client.rpc("list_note_jobs", { p_note_id: id }),
    ]);
    if (noteResult.error) throw noteResult.error;
    if (segmentResult.error) throw segmentResult.error;
    if (attachmentResult.error) throw attachmentResult.error;
    if (outputResult.error) throw outputResult.error;
    if (chatResult.error) throw chatResult.error;
    if (jobResult.error) throw jobResult.error;
    if (!noteResult.data) return null;

    return {
      ...mapNoteRow(noteResult.data as unknown as NoteRow),
      segments: (segmentResult.data as unknown as RecordingSegmentRow[]).map(
        mapRecordingSegmentRow,
      ),
      attachments: (attachmentResult.data as unknown as AttachmentRow[]).map(
        mapAttachmentRow,
      ),
      generatedOutputs: (
        outputResult.data as unknown as GeneratedOutputRow[]
      ).map(mapGeneratedOutputRow),
      chatMessages: (chatResult.data as unknown as ChatMessageRow[]).map(
        mapChatMessageRow,
      ),
      jobs: (jobResult.data as unknown as JobRow[]).map(mapJobRow),
    };
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const { data, error } = await this.client
      .from("notes")
      .insert({
        title: input.title,
        description: input.description ?? null,
        note_type: input.noteType ?? "other",
      })
      .select(NOTE_COLUMNS)
      .single();
    if (error) throw error;
    return mapNoteRow(data as unknown as NoteRow);
  }

  async update(id: string, input: UpdateNoteInput): Promise<Note> {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) values.title = input.title;
    if (input.description !== undefined) values.description = input.description;
    if (input.noteType !== undefined) values.note_type = input.noteType;

    const { data, error } = await this.client
      .from("notes")
      .update(values)
      .eq("id", id)
      .select(NOTE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Note not found.");
    return mapNoteRow(data as unknown as NoteRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("notes").delete().eq("id", id);
    if (error) throw error;
  }

  async getActiveTranscript(id: string): Promise<string> {
    const note = await this.findById(id);
    if (!note) throw new NotFoundError("Note not found.");
    return selectActiveTranscript(note);
  }

  async saveEditedTranscript(id: string, transcript: string): Promise<Note> {
    const { data, error } = await this.client.rpc("save_edited_transcript", {
      p_note_id: id,
      p_transcript: transcript,
    });
    if (error) throw error;
    return mapNoteRow(data as unknown as NoteRow);
  }

  async rebuildRawCombinedTranscript(id: string): Promise<Note> {
    const { data, error } = await this.client.rpc("rebuild_note_raw_transcript", {
      p_note_id: id,
    });
    if (error) throw error;
    return mapNoteRow(data as unknown as NoteRow);
  }
}
