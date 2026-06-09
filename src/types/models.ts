export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

export type NoteType =
  | "meeting"
  | "lecture"
  | "office_hours"
  | "project"
  | "personal"
  | "other";

export type TranscriptVersion = "raw" | "cleaned" | "user_edited";

export type SegmentStatus =
  | "pending_upload"
  | "uploaded"
  | "transcribing"
  | "completed"
  | "failed";

export type AttachmentStatus =
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

export type JobType =
  | "submit_transcription"
  | "generate_note"
  | "index_note"
  | "extract_attachment"
  | "index_attachment";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type GeneratedOutputType =
  | "summary"
  | "markdown_notes"
  | "action_items"
  | "decisions"
  | "topics";

export type ChunkSourceType = "transcript" | "attachment";
export type ChatRole = "user" | "assistant";

export type Note = {
  id: string;
  title: string;
  description: string | null;
  noteType: NoteType;
  rawCombinedTranscript: string | null;
  cleanedTranscript: string | null;
  userEditedTranscript: string | null;
  activeTranscriptVersion: TranscriptVersion;
  transcriptRevision: number;
  indexedRevision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RecordingSegment = {
  id: string;
  noteId: string;
  segmentIndex: number;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  status: SegmentStatus;
  externalProvider: string | null;
  externalJobId: string | null;
  rawTranscript: string | null;
  transcriptJson: unknown;
  speakerLabels: unknown;
  audioDeleted: boolean;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Attachment = {
  id: string;
  noteId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileType: string;
  fileSizeBytes: number;
  extractedText: string | null;
  extractionStatus: AttachmentStatus;
  extractionMetadata: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type GeneratedOutput = {
  id: string;
  noteId: string;
  outputType: GeneratedOutputType;
  content: Record<string, unknown>;
  model: string;
  promptVersion: string;
  sourceRevision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Chunk = {
  id: string;
  noteId: string;
  sourceType: ChunkSourceType;
  sourceId: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[] | string | null;
  embeddingModel: string | null;
  createdAt: Date;
};

export type SubmitTranscriptionPayload = {
  type: "submit_transcription";
  segmentId: string;
};

export type GenerateNotePayload = {
  type: "generate_note";
  noteId: string;
  sourceRevision: number;
};

export type IndexNotePayload = {
  type: "index_note";
  noteId: string;
  sourceRevision: number;
};

export type ExtractAttachmentPayload = {
  type: "extract_attachment";
  attachmentId: string;
};

export type IndexAttachmentPayload = {
  type: "index_attachment";
  attachmentId: string;
};

export type JobPayload =
  | SubmitTranscriptionPayload
  | GenerateNotePayload
  | IndexNotePayload
  | ExtractAttachmentPayload
  | IndexAttachmentPayload;

type JobBase = {
  id: string;
  status: JobStatus;
  deduplicationKey: string;
  result: unknown;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type Job = JobBase &
  (
    | { type: "submit_transcription"; payload: SubmitTranscriptionPayload }
    | { type: "generate_note"; payload: GenerateNotePayload }
    | { type: "index_note"; payload: IndexNotePayload }
    | { type: "extract_attachment"; payload: ExtractAttachmentPayload }
    | { type: "index_attachment"; payload: IndexAttachmentPayload }
  );

export type ChatCitation = {
  chunkId: string;
  quote: string;
};

export type ChatMessage = {
  id: string;
  noteId: string;
  role: ChatRole;
  content: string;
  citations: ChatCitation[];
  createdAt: Date;
};

export type NoteDetail = Note & {
  segments: RecordingSegment[];
  attachments: Attachment[];
  generatedOutputs: GeneratedOutput[];
  chatMessages: ChatMessage[];
  jobs: Job[];
};

export type {
  AttachmentRow,
  ChatMessageRow,
  ChunkRow,
  GeneratedOutputRow,
  JobRow,
  NoteDetailRow,
  NoteRow,
  RecordingSegmentRow,
} from "@/types/database";
