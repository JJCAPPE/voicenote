import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  chooseRecorderMimeType,
  formatRecordingTime,
} from "@/features/recordings/lib/recorder-utils";
import {
  CreateSegmentSchema,
  MAX_AUDIO_BYTES,
  extensionForMimeType,
} from "@/features/recordings/schemas/recording.schema";
import type { RecordingSegmentRepository } from "@/server/repositories/recording-segment.repository";
import type { JobService } from "@/server/services/job.service";
import { RecordingService } from "@/server/services/recording.service";
import type { AudioStorage } from "@/server/services/storage.gateway";
import type { RecordingSegment } from "@/types/models";

const noteId = "11111111-1111-4111-8111-111111111111";
const segmentId = "22222222-2222-4222-8222-222222222222";
const segment: RecordingSegment = {
  id: segmentId,
  noteId,
  segmentIndex: 1,
  originalFilename: "audio.webm",
  storagePath: `notes/${noteId}/segments/${segmentId}.webm`,
  mimeType: "audio/webm;codecs=opus",
  fileSizeBytes: 42,
  durationSeconds: 12,
  status: "pending_upload",
  externalProvider: null,
  externalJobId: null,
  rawTranscript: null,
  transcriptJson: null,
  speakerLabels: null,
  audioDeleted: false,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("recording helpers", () => {
  it("selects WebM/Opus, then MP4, then browser default", () => {
    expect(
      chooseRecorderMimeType({
        isTypeSupported: (type) => type === "audio/webm;codecs=opus",
      }),
    ).toBe("audio/webm;codecs=opus");
    expect(
      chooseRecorderMimeType({
        isTypeSupported: (type) => type === "audio/mp4",
      }),
    ).toBe("audio/mp4");
    expect(
      chooseRecorderMimeType({ isTypeSupported: () => false }),
    ).toBeUndefined();
    expect(formatRecordingTime(65)).toBe("01:05");
  });

  it("validates signed upload metadata and size", () => {
    expect(
      CreateSegmentSchema.safeParse({
        noteId,
        filename: "recording.webm",
        mimeType: "audio/webm;codecs=opus",
        fileSizeBytes: 1024,
        durationSeconds: 10,
      }).success,
    ).toBe(true);
    expect(
      CreateSegmentSchema.safeParse({
        noteId,
        filename: "recording.webm",
        mimeType: "video/webm",
        fileSizeBytes: 1024,
        durationSeconds: 10,
      }).success,
    ).toBe(false);
    expect(
      CreateSegmentSchema.safeParse({
        noteId,
        filename: "recording.webm",
        mimeType: "audio/webm",
        fileSizeBytes: MAX_AUDIO_BYTES + 1,
        durationSeconds: 10,
      }).success,
    ).toBe(false);
    expect(extensionForMimeType("audio/webm;codecs=opus")).toBe("webm");
  });

  it("verifies storage before marking uploaded and enqueuing", async () => {
    const segments = {
      findById: vi.fn(async () => segment),
      markUploaded: vi.fn(async () => ({ ...segment, status: "uploaded" as const })),
    };
    const storage = { verifyObject: vi.fn(async () => undefined) };
    const jobs = { enqueue: vi.fn(async () => undefined) };
    const service = new RecordingService(
      segments as unknown as RecordingSegmentRepository,
      storage as unknown as AudioStorage,
      jobs as unknown as JobService,
    );

    await service.confirmSegmentUpload({ segmentId });
    expect(storage.verifyObject).toHaveBeenCalledWith(segment.storagePath, 42);
    expect(segments.markUploaded).toHaveBeenCalledAfter(storage.verifyObject);
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "submit_transcription",
      segmentId,
    });
  });

  it("rejects invalid segment confirmation metadata", async () => {
    const service = new RecordingService(
      {} as RecordingSegmentRepository,
      {} as AudioStorage,
      {} as JobService,
    );
    await expect(
      service.confirmSegmentUpload({ segmentId: "bad" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
