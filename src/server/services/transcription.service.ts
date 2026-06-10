import { ProviderError, StorageError, ValidationError } from "@/lib/errors";
import type { TranscriptionProvider } from "@/lib/ai/transcription.provider";
import type { NoteRepository } from "@/server/repositories/note.repository";
import type { RecordingSegmentRepository } from "@/server/repositories/recording-segment.repository";
import type { AudioStorage } from "@/server/services/storage.gateway";
import type { JobService } from "@/server/services/job.service";
import type { Job, RecordingSegment } from "@/types/models";

export type WebhookResult =
  | { status: "completed"; segment: RecordingSegment }
  | { status: "duplicate"; segment: RecordingSegment }
  | { status: "failed"; segment: RecordingSegment };

export class TranscriptionService {
  constructor(
    private readonly segments: RecordingSegmentRepository,
    private readonly notes: NoteRepository,
    private readonly jobs: JobService,
    private readonly storage: AudioStorage,
    private readonly provider: TranscriptionProvider,
    private readonly webhookUrl: string,
    private readonly webhookSecret: string,
  ) {}

  async processSubmitJob(job: Job): Promise<void> {
    if (
      job.type !== "submit_transcription" ||
      job.payload.type !== "submit_transcription"
    ) {
      throw new ValidationError("Unexpected job type.");
    }

    try {
      const segment = await this.submitTranscription(job.payload.segmentId);
      await this.jobs.markCompleted(job.id, {
        segmentId: segment.id,
        externalJobId: segment.externalJobId,
      });
    } catch (error) {
      await this.jobs.markFailed(job.id, error);
      throw error;
    }
  }

  async submitTranscription(segmentId: string): Promise<RecordingSegment> {
    const segment = await this.segments.findById(segmentId);
    if (!segment) throw new ValidationError("Recording segment was not found.");
    if (segment.status === "completed" || segment.status === "transcribing") {
      return segment;
    }
    if (segment.status !== "uploaded") {
      throw new ValidationError("Recording segment is not ready for transcription.");
    }

    const audioUrl = await this.storage.createSignedDownload(
      segment.storagePath,
      15 * 60,
    );
    const submitted = await this.provider.submitAudio({
      audioUrl,
      webhookUrl: this.webhookUrl,
      webhookSecret: this.webhookSecret,
    });
    return this.segments.markTranscribing(segment.id, submitted.externalJobId);
  }

  async handleCompletedCallback(externalJobId: string): Promise<WebhookResult> {
    const segment = await this.segments.findByExternalJobId(externalJobId);
    if (!segment) throw new ValidationError("Unknown transcription job.");
    if (segment.status === "completed") {
      return { status: "duplicate", segment };
    }
    if (segment.status !== "transcribing") {
      throw new ValidationError("Recording segment is not transcribing.");
    }

    let transcript;
    try {
      transcript = await this.provider.getTranscript(externalJobId);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      const failed = await this.segments.markFailed(
        segment.id,
        error.publicMessage,
      );
      return { status: "failed", segment: failed };
    }

    const completed = await this.segments.markCompleted(segment.id, {
      rawTranscript: transcript.text,
      transcriptJson: transcript.providerPayload,
      speakerLabels: transcript.utterances.map((utterance) => ({
        speaker: utterance.speaker,
        start: utterance.start,
        end: utterance.end,
        text: utterance.text,
      })),
    });
    const note = await this.notes.rebuildRawCombinedTranscript(segment.noteId);

    try {
      await this.storage.deleteObject(segment.storagePath);
      await this.segments.markAudioDeleted(segment.id);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("Transcript saved, but audio cleanup failed.", {
        cause: error,
      });
    }

    await this.jobs.enqueue({
      type: "generate_note",
      noteId: note.id,
      sourceRevision: note.generationRevision,
    });
    return { status: "completed", segment: completed };
  }
}
