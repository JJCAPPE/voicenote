import { randomUUID } from "node:crypto";
import { ValidationError } from "@/lib/errors";
import {
  ConfirmSegmentSchema,
  CreateSegmentSchema,
  extensionForMimeType,
  RetrySegmentSchema,
} from "@/features/recordings/schemas/recording.schema";
import type { RecordingSegmentRepository } from "@/server/repositories/recording-segment.repository";
import type { JobService } from "@/server/services/job.service";
import type { AudioStorage, SignedUpload } from "@/server/services/storage.gateway";
import type { RecordingSegment } from "@/types/models";

export interface SegmentUpload {
  segment: RecordingSegment;
  upload: SignedUpload;
}

export class RecordingService {
  constructor(
    private readonly segments: RecordingSegmentRepository,
    private readonly storage: AudioStorage,
    private readonly jobs: JobService,
  ) {}

  async createSegment(input: unknown): Promise<SegmentUpload> {
    const parsed = CreateSegmentSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid audio metadata.");

    const id = randomUUID();
    const segment = await this.segments.createPending({
      id,
      noteId: parsed.data.noteId,
      originalFilename: parsed.data.filename,
      extension: extensionForMimeType(parsed.data.mimeType),
      mimeType: parsed.data.mimeType,
      fileSizeBytes: parsed.data.fileSizeBytes,
      durationSeconds: Math.round(parsed.data.durationSeconds),
    });
    const upload = await this.storage.createSignedUpload(segment.storagePath);
    return { segment, upload };
  }

  async confirmSegmentUpload(input: unknown): Promise<RecordingSegment> {
    const parsed = ConfirmSegmentSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid recording segment.");

    const segment = await this.segments.findById(parsed.data.segmentId);
    if (!segment) throw new ValidationError("Recording segment was not found.");
    if (segment.status !== "pending_upload") {
      if (segment.status === "uploaded" || segment.status === "transcribing") {
        return segment;
      }
      throw new ValidationError("Recording segment cannot be confirmed.");
    }

    await this.storage.verifyObject(segment.storagePath, segment.fileSizeBytes);
    const uploaded = await this.segments.markUploaded(segment.id);
    await this.jobs.enqueue({
      type: "submit_transcription",
      segmentId: segment.id,
    });
    return uploaded;
  }

  async retrySegment(input: unknown): Promise<RecordingSegment> {
    const parsed = RetrySegmentSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError("Invalid recording segment.");

    const segment = await this.segments.findById(parsed.data.segmentId);
    if (!segment) throw new ValidationError("Recording segment was not found.");
    if (segment.status !== "failed" || segment.audioDeleted) {
      throw new ValidationError("Recording segment cannot be retried.");
    }

    const uploaded = await this.segments.markUploaded(segment.id);
    await this.jobs.enqueue({
      type: "submit_transcription",
      segmentId: segment.id,
    });
    return uploaded;
  }
}
