import { describe, expect, it } from "vitest";

import {
  mapAttachmentRow,
  mapChatMessageRow,
  mapChunkRow,
  mapGeneratedOutputRow,
  mapJobRow,
  mapNoteDetailRow,
  mapNoteRow,
  mapRecordingSegmentRow,
} from "@/types/mappers";
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

const createdAt = "2026-06-09T10:00:00.000Z";
const updatedAt = "2026-06-09T11:00:00.000Z";

const noteRow: NoteRow = {
  id: "note-1",
  title: "Lecture",
  description: null,
  note_type: "lecture",
  raw_combined_transcript: null,
  cleaned_transcript: null,
  user_edited_transcript: null,
  active_transcript_version: "raw",
  transcript_revision: 0,
  indexed_revision: 0,
  created_at: createdAt,
  updated_at: updatedAt,
};

const segmentRow: RecordingSegmentRow = {
  id: "segment-1",
  note_id: "note-1",
  segment_index: 0,
  original_filename: "recording.webm",
  storage_path: "notes/note-1/segments/segment-1.webm",
  mime_type: "audio/webm",
  file_size_bytes: "123",
  duration_seconds: 10,
  status: "uploaded",
  external_provider: null,
  external_job_id: null,
  raw_transcript: null,
  transcript_json: null,
  speaker_labels: null,
  audio_deleted: false,
  error_message: null,
  created_at: createdAt,
  updated_at: updatedAt,
};

const attachmentRow: AttachmentRow = {
  id: "attachment-1",
  note_id: "note-1",
  filename: "reference.pdf",
  storage_path: "notes/note-1/attachment-1/reference.pdf",
  mime_type: "application/pdf",
  file_type: "pdf",
  file_size_bytes: 123,
  extracted_text: null,
  extraction_metadata: null,
  extraction_status: "uploaded",
  error_message: null,
  created_at: createdAt,
};

const outputRow: GeneratedOutputRow = {
  id: "output-1",
  note_id: "note-1",
  output_type: "summary",
  content: { shortSummary: "Short" },
  model: "gemini-2.5-flash",
  prompt_version: "summarize-note.v1",
  source_revision: 1,
  created_at: createdAt,
  updated_at: updatedAt,
};

const chunkRow: ChunkRow = {
  id: "chunk-1",
  note_id: "note-1",
  source_type: "transcript",
  source_id: "note-1",
  chunk_index: 0,
  content: "Transcript text",
  metadata: null,
  embedding: [0.1, 0.2],
  embedding_model: "gemini-embedding-001",
  created_at: createdAt,
};

const jobRow: JobRow = {
  id: "job-1",
  job_type: "index_note",
  status: "queued",
  payload: { type: "index_note", noteId: "note-1", sourceRevision: 1 },
  result: null,
  error_message: null,
  attempts: 0,
  max_attempts: 3,
  deduplication_key: "index_note:note-1:1",
  created_at: createdAt,
  started_at: null,
  completed_at: null,
};

const chatRow: ChatMessageRow = {
  id: "message-1",
  note_id: "note-1",
  role: "assistant",
  content: "Answer",
  citations: [],
  created_at: createdAt,
};

describe("row mappers", () => {
  it("maps notes and nullable fields", () => {
    const note = mapNoteRow(noteRow);

    expect(note.createdAt).toEqual(new Date(createdAt));
    expect(note.updatedAt).toEqual(new Date(updatedAt));
    expect(note.description).toBeNull();
    expect(note.cleanedTranscript).toBeNull();
  });

  it("maps recording segments", () => {
    const segment = mapRecordingSegmentRow(segmentRow);

    expect(segment.noteId).toBe("note-1");
    expect(segment.fileSizeBytes).toBe(123);
    expect(segment.createdAt).toEqual(new Date(createdAt));
  });

  it("maps attachments", () => {
    const attachment = mapAttachmentRow(attachmentRow);

    expect(attachment.extractedText).toBeNull();
    expect(attachment.createdAt).toEqual(new Date(createdAt));
  });

  it("maps generated outputs", () => {
    const output = mapGeneratedOutputRow(outputRow);

    expect(output.promptVersion).toBe("summarize-note.v1");
    expect(output.updatedAt).toEqual(new Date(updatedAt));
  });

  it("maps chunks", () => {
    const chunk = mapChunkRow(chunkRow);

    expect(chunk.metadata).toEqual({});
    expect(chunk.createdAt).toEqual(new Date(createdAt));
  });

  it("maps jobs and nullable timestamps", () => {
    const job = mapJobRow(jobRow);

    expect(job.deduplicationKey).toBe("index_note:note-1:1");
    expect(job.startedAt).toBeNull();
    expect(job.completedAt).toBeNull();
  });

  it("maps chat messages", () => {
    const message = mapChatMessageRow(chatRow);

    expect(message.noteId).toBe("note-1");
    expect(message.createdAt).toEqual(new Date(createdAt));
  });

  it("maps note details with all child arrays", () => {
    const detailRow: NoteDetailRow = {
      ...noteRow,
      recording_segments: [segmentRow],
      attachments: [attachmentRow],
      generated_outputs: [outputRow],
      chat_messages: [chatRow],
      jobs: [jobRow],
    };

    const detail = mapNoteDetailRow(detailRow);

    expect(detail.segments).toHaveLength(1);
    expect(detail.attachments).toHaveLength(1);
    expect(detail.generatedOutputs).toHaveLength(1);
    expect(detail.chatMessages).toHaveLength(1);
    expect(detail.jobs).toHaveLength(1);
  });
});
