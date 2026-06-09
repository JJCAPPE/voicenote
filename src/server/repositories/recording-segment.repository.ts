import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import { mapRecordingSegmentRow } from "@/types/mappers";
import type { RecordingSegment, RecordingSegmentRow } from "@/types/models";

const COLUMNS =
  "id,note_id,segment_index,original_filename,storage_path,mime_type,file_size_bytes,duration_seconds,status,external_provider,external_job_id,raw_transcript,transcript_json,speaker_labels,audio_deleted,error_message,created_at,updated_at";

export interface CreateSegmentInput {
  id: string;
  noteId: string;
  originalFilename: string;
  extension: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
}

export interface CompleteSegmentInput {
  rawTranscript: string;
  transcriptJson: unknown;
  speakerLabels: unknown;
}

export class RecordingSegmentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createPending(input: CreateSegmentInput): Promise<RecordingSegment> {
    const { data, error } = await this.client.rpc("create_recording_segment", {
      p_id: input.id,
      p_note_id: input.noteId,
      p_original_filename: input.originalFilename,
      p_extension: input.extension,
      p_mime_type: input.mimeType,
      p_file_size_bytes: input.fileSizeBytes,
      p_duration_seconds: input.durationSeconds,
    });
    if (error) throw error;
    return mapRecordingSegmentRow(data as unknown as RecordingSegmentRow);
  }

  async findById(id: string): Promise<RecordingSegment | null> {
    const { data, error } = await this.client
      .from("recording_segments")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data
      ? mapRecordingSegmentRow(data as unknown as RecordingSegmentRow)
      : null;
  }

  async findByExternalJobId(externalJobId: string): Promise<RecordingSegment | null> {
    const { data, error } = await this.client
      .from("recording_segments")
      .select(COLUMNS)
      .eq("external_job_id", externalJobId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? mapRecordingSegmentRow(data as unknown as RecordingSegmentRow)
      : null;
  }

  async markUploaded(id: string): Promise<RecordingSegment> {
    return this.update(id, { status: "uploaded", error_message: null });
  }

  async markTranscribing(
    id: string,
    externalJobId: string,
  ): Promise<RecordingSegment> {
    return this.update(id, {
      status: "transcribing",
      external_provider: "assemblyai",
      external_job_id: externalJobId,
      error_message: null,
    });
  }

  async markCompleted(
    id: string,
    input: CompleteSegmentInput,
  ): Promise<RecordingSegment> {
    return this.update(id, {
      status: "completed",
      raw_transcript: input.rawTranscript,
      transcript_json: input.transcriptJson,
      speaker_labels: input.speakerLabels,
      error_message: null,
    });
  }

  async markFailed(id: string, message: string): Promise<RecordingSegment> {
    return this.update(id, { status: "failed", error_message: message });
  }

  async markAudioDeleted(id: string): Promise<RecordingSegment> {
    return this.update(id, { audio_deleted: true });
  }

  private async update(
    id: string,
    values: Record<string, unknown>,
  ): Promise<RecordingSegment> {
    const { data, error } = await this.client
      .from("recording_segments")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Recording segment not found.");
    return mapRecordingSegmentRow(data as unknown as RecordingSegmentRow);
  }
}
