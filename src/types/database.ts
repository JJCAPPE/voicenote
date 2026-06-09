import type {
  AttachmentStatus,
  ChatCitation,
  ChatRole,
  ChunkSourceType,
  GeneratedOutputType,
  JobPayload,
  JobStatus,
  JobType,
  NoteType,
  SegmentStatus,
  TranscriptVersion,
} from "@/types/models";

export type NoteRow = {
  id: string;
  title: string;
  description: string | null;
  note_type: NoteType;
  raw_combined_transcript: string | null;
  cleaned_transcript: string | null;
  user_edited_transcript: string | null;
  active_transcript_version: TranscriptVersion;
  transcript_revision: number;
  indexed_revision: number;
  created_at: string;
  updated_at: string;
};

export type RecordingSegmentRow = {
  id: string;
  note_id: string;
  segment_index: number;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | string;
  duration_seconds: number;
  status: SegmentStatus;
  external_provider: string | null;
  external_job_id: string | null;
  raw_transcript: string | null;
  transcript_json: unknown;
  speaker_labels: unknown;
  audio_deleted: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type AttachmentRow = {
  id: string;
  note_id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  file_type: string;
  file_size_bytes: number | string;
  extracted_text: string | null;
  extraction_status: AttachmentStatus;
  extraction_metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

export type GeneratedOutputRow = {
  id: string;
  note_id: string;
  output_type: GeneratedOutputType;
  content: Record<string, unknown>;
  model: string;
  prompt_version: string;
  source_revision: number;
  created_at: string;
  updated_at: string;
};

export type ChunkRow = {
  id: string;
  note_id: string;
  source_type: ChunkSourceType;
  source_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
  embedding: number[] | string | null;
  embedding_model: string | null;
  created_at: string;
};

export type JobRow = {
  id: string;
  job_type: JobType;
  status: JobStatus;
  payload: JobPayload;
  deduplication_key: string;
  result: unknown;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type ChatMessageRow = {
  id: string;
  note_id: string;
  role: ChatRole;
  content: string;
  citations: ChatCitation[] | null;
  created_at: string;
};

export type NoteDetailRow = NoteRow & {
  recording_segments: RecordingSegmentRow[];
  attachments: AttachmentRow[];
  generated_outputs: GeneratedOutputRow[];
  chat_messages: ChatMessageRow[];
  jobs: JobRow[];
};
