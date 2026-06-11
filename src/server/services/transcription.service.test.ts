import { describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  StorageError,
  TranscriptionPendingError,
} from "@/lib/errors";
import type { TranscriptionProvider } from "@/lib/ai/transcription.provider";
import type { NoteRepository } from "@/server/repositories/note.repository";
import type { RecordingSegmentRepository } from "@/server/repositories/recording-segment.repository";
import type { JobService } from "@/server/services/job.service";
import type { AudioStorage } from "@/server/services/storage.gateway";
import { TranscriptionService } from "@/server/services/transcription.service";
import type { Note, RecordingSegment } from "@/types/models";

const noteId = "11111111-1111-4111-8111-111111111111";
const segmentId = "22222222-2222-4222-8222-222222222222";
const segment: RecordingSegment = {
  id: segmentId,
  noteId,
  segmentIndex: 1,
  originalFilename: "audio.webm",
  storagePath: `notes/${noteId}/segments/${segmentId}.webm`,
  mimeType: "audio/webm",
  fileSizeBytes: 42,
  durationSeconds: 12,
  status: "transcribing",
  externalProvider: "assemblyai",
  externalJobId: "external-1",
  rawTranscript: null,
  transcriptJson: null,
  speakerLabels: null,
  audioDeleted: false,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const note: Note = {
  id: noteId,
  title: "Note",
  description: null,
  noteType: "other",
  liveNotes: "",
  rawCombinedTranscript: "Transcript",
  cleanedTranscript: null,
  userEditedTranscript: null,
  activeTranscriptVersion: "raw",
  transcriptRevision: 1,
  generationRevision: 1,
  indexedRevision: 0,
  titleOrigin: "user",
  descriptionOrigin: "placeholder",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const transcript = {
  text: "Transcript",
  language: "en",
  durationSeconds: 12,
  utterances: [
    {
      text: "Transcript",
      start: 0,
      end: 1000,
      confidence: 0.9,
      speaker: "A",
      words: [],
    },
  ],
  words: [],
  providerPayload: { id: "external-1" },
};

function setup(overrides?: {
  segment?: RecordingSegment;
  providerError?: Error;
  persistenceError?: Error;
  deletionError?: Error;
}) {
  const current = overrides?.segment ?? segment;
  const segments = {
    findById: vi.fn(async () => current),
    findByExternalJobId: vi.fn(async () => current),
    markFailed: vi.fn(async (_id, message) => ({
      ...current,
      status: "failed" as const,
      errorMessage: message,
    })),
    markCompleted: vi.fn(async () => {
      if (overrides?.persistenceError) throw overrides.persistenceError;
      return { ...current, status: "completed" as const, rawTranscript: "Transcript" };
    }),
    markAudioDeleted: vi.fn(async () => ({
      ...current,
      status: "completed" as const,
      audioDeleted: true,
    })),
  };
  const notes = {
    rebuildRawCombinedTranscript: vi.fn(async () => ({
      ...note,
      transcriptRevision: 2,
      generationRevision: 2,
    })),
  };
  const jobs = { enqueue: vi.fn(async () => undefined) };
  const storage = {
    deleteObject: vi.fn(async () => {
      if (overrides?.deletionError) throw overrides.deletionError;
    }),
  };
  const provider = {
    getTranscript: vi.fn(async () => {
      if (overrides?.providerError) throw overrides.providerError;
      return transcript;
    }),
  };
  const service = new TranscriptionService(
    segments as unknown as RecordingSegmentRepository,
    notes as unknown as NoteRepository,
    jobs as unknown as JobService,
    storage as unknown as AudioStorage,
    provider as unknown as TranscriptionProvider,
    "https://app.example/api/webhooks/assemblyai",
    "secret",
  );
  return { service, segments, notes, jobs, storage, provider };
}

describe("TranscriptionService webhook processing", () => {
  it("leaves provider work pending during status sync", async () => {
    const pending = setup({
      providerError: new TranscriptionPendingError(),
    });
    await expect(
      pending.service.syncTranscription(segmentId),
    ).resolves.toEqual(expect.objectContaining({ status: "pending" }));
    expect(pending.segments.markFailed).not.toHaveBeenCalled();
  });

  it("treats completed callbacks as duplicate no-ops", async () => {
    const completed = setup({
      segment: { ...segment, status: "completed", rawTranscript: "Transcript" },
    });
    await expect(
      completed.service.handleCompletedCallback("external-1"),
    ).resolves.toEqual(expect.objectContaining({ status: "duplicate" }));
    expect(completed.provider.getTranscript).not.toHaveBeenCalled();
    expect(completed.storage.deleteObject).not.toHaveBeenCalled();
  });

  it("marks provider failures while preserving audio", async () => {
    const failed = setup({ providerError: new ProviderError("failed") });
    await expect(
      failed.service.handleCompletedCallback("external-1"),
    ).resolves.toEqual(expect.objectContaining({ status: "failed" }));
    expect(failed.segments.markFailed).toHaveBeenCalled();
    expect(failed.storage.deleteObject).not.toHaveBeenCalled();
  });

  it("does not delete audio when transcript persistence fails", async () => {
    const failed = setup({ persistenceError: new Error("database failed") });
    await expect(
      failed.service.handleCompletedCallback("external-1"),
    ).rejects.toThrow("database failed");
    expect(failed.storage.deleteObject).not.toHaveBeenCalled();
    expect(failed.jobs.enqueue).not.toHaveBeenCalled();
  });

  it("persists the segment and combined transcript before deleting audio", async () => {
    const success = setup();
    await expect(
      success.service.handleCompletedCallback("external-1"),
    ).resolves.toEqual(expect.objectContaining({ status: "completed" }));
    expect(success.segments.markCompleted).toHaveBeenCalledBefore(
      success.notes.rebuildRawCombinedTranscript,
    );
    expect(success.notes.rebuildRawCombinedTranscript).toHaveBeenCalledBefore(
      success.storage.deleteObject,
    );
    expect(success.storage.deleteObject).toHaveBeenCalledBefore(
      success.segments.markAudioDeleted,
    );
    expect(success.jobs.enqueue).toHaveBeenCalledWith({
      type: "generate_note",
      noteId,
      sourceRevision: 2,
    });
  });

  it("keeps persisted transcript completed when audio cleanup fails", async () => {
    const failed = setup({
      deletionError: new StorageError("cleanup failed"),
    });
    await expect(
      failed.service.handleCompletedCallback("external-1"),
    ).rejects.toBeInstanceOf(StorageError);
    expect(failed.segments.markCompleted).toHaveBeenCalled();
    expect(failed.segments.markAudioDeleted).not.toHaveBeenCalled();
  });
});
