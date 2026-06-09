import type {
  AttachmentRow,
  ChatMessageRow,
  ChunkRow,
  GeneratedOutputRow,
  JobRow,
  NoteDetailRow,
  NoteRow,
  RecordingSegmentRow,
} from "@/types/database";
import type {
  Attachment,
  ChatMessage,
  Chunk,
  GeneratedOutput,
  Job,
  Note,
  NoteDetail,
  RecordingSegment,
} from "@/types/models";

function mapNullableDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

export function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    noteType: row.note_type,
    rawCombinedTranscript: row.raw_combined_transcript,
    cleanedTranscript: row.cleaned_transcript,
    userEditedTranscript: row.user_edited_transcript,
    activeTranscriptVersion: row.active_transcript_version,
    transcriptRevision: row.transcript_revision,
    indexedRevision: row.indexed_revision,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapRecordingSegmentRow(
  row: RecordingSegmentRow,
): RecordingSegment {
  return {
    id: row.id,
    noteId: row.note_id,
    segmentIndex: row.segment_index,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    durationSeconds: row.duration_seconds,
    status: row.status,
    externalProvider: row.external_provider,
    externalJobId: row.external_job_id,
    rawTranscript: row.raw_transcript,
    transcriptJson: row.transcript_json,
    speakerLabels: row.speaker_labels,
    audioDeleted: row.audio_deleted,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapAttachmentRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    noteId: row.note_id,
    filename: row.filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileType: row.file_type,
    fileSizeBytes: Number(row.file_size_bytes),
    extractedText: row.extracted_text,
    extractionStatus: row.extraction_status,
    extractionMetadata: row.extraction_metadata,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
  };
}

export function mapGeneratedOutputRow(
  row: GeneratedOutputRow,
): GeneratedOutput {
  return {
    id: row.id,
    noteId: row.note_id,
    outputType: row.output_type,
    content: row.content,
    model: row.model,
    promptVersion: row.prompt_version,
    sourceRevision: row.source_revision,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapChunkRow(row: ChunkRow): Chunk {
  return {
    id: row.id,
    noteId: row.note_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    metadata: row.metadata ?? {},
    embedding: row.embedding,
    embeddingModel: row.embedding_model,
    createdAt: new Date(row.created_at),
  };
}

export function mapJobRow(row: JobRow): Job {
  return {
    id: row.id,
    type: row.job_type,
    status: row.status,
    payload: row.payload,
    deduplicationKey: row.deduplication_key,
    result: row.result,
    errorMessage: row.error_message,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    createdAt: new Date(row.created_at),
    startedAt: mapNullableDate(row.started_at),
    completedAt: mapNullableDate(row.completed_at),
  } as Job;
}

export function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    noteId: row.note_id,
    role: row.role,
    content: row.content,
    citations: row.citations ?? [],
    createdAt: new Date(row.created_at),
  };
}

export function mapNoteDetailRow(row: NoteDetailRow): NoteDetail {
  return {
    ...mapNoteRow(row),
    segments: row.recording_segments.map(mapRecordingSegmentRow),
    attachments: row.attachments.map(mapAttachmentRow),
    generatedOutputs: row.generated_outputs.map(mapGeneratedOutputRow),
    chatMessages: row.chat_messages.map(mapChatMessageRow),
    jobs: row.jobs.map(mapJobRow),
  };
}
