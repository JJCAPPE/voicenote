import type { SupabaseClient } from "@supabase/supabase-js";

import { StorageError } from "@/lib/errors";

export type GenerationSegment = {
  id: string;
  index: number;
  label: string;
};

export type GenerationSource = {
  noteId: string;
  sourceRevision: number;
  activeTranscriptVersion: "raw" | "cleaned" | "user_edited";
  transcript: string;
  segments: GenerationSegment[];
};

export type TranscriptIndexSource = {
  noteId: string;
  sourceRevision: number;
  transcript: string;
};

export type AttachmentIndexSource = {
  attachmentId: string;
  noteId: string;
  filename: string;
  text: string;
  metadata: Record<string, unknown>;
};

type NoteRow = {
  id: string;
  transcript_revision: number;
  active_transcript_version: GenerationSource["activeTranscriptVersion"];
  raw_combined_transcript: string | null;
  cleaned_transcript: string | null;
  user_edited_transcript: string | null;
  recording_segments?: Array<{
    id: string;
    segment_index: number;
    original_filename: string | null;
    status: string;
  }>;
};

function activeTranscript(row: NoteRow): string {
  if (row.active_transcript_version === "user_edited") {
    return row.user_edited_transcript ?? "";
  }
  if (row.active_transcript_version === "cleaned") {
    return row.cleaned_transcript ?? "";
  }
  return row.raw_combined_transcript ?? "";
}

export class AiSourceRepository {
  constructor(private readonly database: SupabaseClient) {}

  async getGenerationSource(noteId: string): Promise<GenerationSource | null> {
    const { data, error } = await this.database
      .from("notes")
      .select(
        "id, transcript_revision, active_transcript_version, raw_combined_transcript, cleaned_transcript, user_edited_transcript, recording_segments(id, segment_index, original_filename, status)",
      )
      .eq("id", noteId)
      .maybeSingle();

    if (error) {
      throw new StorageError("The note could not be loaded.", { cause: error });
    }
    if (!data) {
      return null;
    }

    const row = data as unknown as NoteRow;
    const segments = (row.recording_segments ?? [])
      .filter((segment) => segment.status === "completed")
      .sort((left, right) => left.segment_index - right.segment_index)
      .map((segment) => ({
        id: segment.id,
        index: segment.segment_index,
        label: `Segment ${segment.segment_index}${
          segment.original_filename ? `: ${segment.original_filename}` : ""
        }`,
      }));

    return {
      noteId: row.id,
      sourceRevision: row.transcript_revision,
      activeTranscriptVersion: row.active_transcript_version,
      transcript: activeTranscript(row),
      segments,
    };
  }

  async getTranscriptIndexSource(
    noteId: string,
  ): Promise<TranscriptIndexSource | null> {
    const { data, error } = await this.database
      .from("notes")
      .select(
        "id, transcript_revision, active_transcript_version, raw_combined_transcript, cleaned_transcript, user_edited_transcript",
      )
      .eq("id", noteId)
      .maybeSingle();

    if (error) {
      throw new StorageError("The note could not be loaded.", { cause: error });
    }
    if (!data) {
      return null;
    }

    const row = data as unknown as NoteRow;
    return {
      noteId: row.id,
      sourceRevision: row.transcript_revision,
      transcript: activeTranscript(row),
    };
  }

  async getAttachmentIndexSource(
    attachmentId: string,
  ): Promise<AttachmentIndexSource | null> {
    const { data, error } = await this.database
      .from("attachments")
      .select(
        "id, note_id, filename, extracted_text, extraction_metadata, extraction_status",
      )
      .eq("id", attachmentId)
      .maybeSingle();

    if (error) {
      throw new StorageError("The attachment could not be loaded.", {
        cause: error,
      });
    }
    if (!data) {
      return null;
    }

    const row = data as {
      id: string;
      note_id: string;
      filename: string;
      extracted_text: string | null;
      extraction_metadata: Record<string, unknown> | null;
      extraction_status: string;
    };
    if (row.extraction_status !== "completed") {
      return null;
    }

    return {
      attachmentId: row.id,
      noteId: row.note_id,
      filename: row.filename,
      text: row.extracted_text ?? "",
      metadata: row.extraction_metadata ?? {},
    };
  }
}
