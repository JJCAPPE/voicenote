import { JobStateError, NotFoundError, ValidationError } from "@/lib/errors";
import { JobPayloadSchema } from "@/features/jobs/schemas/job.schema";
import type { JobRepository } from "@/server/repositories/job.repository";
import type { Job, JobPayload, JobType } from "@/types/models";

export interface JobTrigger {
  invoke(): Promise<void>;
}

export class JobService {
  constructor(
    private readonly repository: JobRepository,
    private readonly trigger?: JobTrigger,
  ) {}

  async enqueue(input: unknown): Promise<Job> {
    const parsed = JobPayloadSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Invalid job payload.");
    }

    const payload = parsed.data as JobPayload;
    const deduplicationKey = this.getDeduplicationKey(payload);
    const existing = await this.repository.findActiveByKey(deduplicationKey);
    if (existing) return existing;

    let job: Job;
    try {
      job = await this.repository.insert({ payload, deduplicationKey });
    } catch (error) {
      const racedJob = await this.repository.findActiveByKey(deduplicationKey);
      if (!racedJob) throw error;
      job = racedJob;
    }

    if (this.trigger) {
      void this.trigger.invoke().catch(() => {
        // Scheduled queue recovery handles invocation failures.
      });
    }
    return job;
  }

  async claimBatch(limit: number, types?: JobType[]): Promise<Job[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError("Claim limit must be between 1 and 100.");
    }
    return this.repository.claimBatch(limit, types);
  }

  async markCompleted(jobId: string, result?: unknown): Promise<void> {
    const job = await this.get(jobId);
    if (job.status === "completed") return;
    if (job.status !== "processing") {
      throw new JobStateError("Only processing jobs can be completed.");
    }

    const updated = await this.repository.updateStatus(jobId, "processing", {
      status: "completed",
      result: result ?? null,
      completed_at: new Date().toISOString(),
      error_message: null,
    });
    if (!updated) throw new JobStateError();
  }

  async markFailed(jobId: string, error: unknown): Promise<void> {
    const job = await this.get(jobId);
    if (job.status !== "processing") {
      throw new JobStateError("Only processing jobs can be failed.");
    }

    const message = error instanceof Error ? error.message : "Job failed.";
    const updated = await this.repository.updateStatus(jobId, "processing", {
      status: "failed",
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    });
    if (!updated) throw new JobStateError();
  }

  async retry(jobId: string): Promise<Job> {
    const job = await this.get(jobId);
    if (job.status !== "failed") {
      throw new JobStateError("Only failed jobs can be retried.");
    }
    if (job.attempts >= job.maxAttempts) {
      throw new JobStateError("This job has reached its maximum attempts.");
    }

    const updated = await this.repository.updateStatus(jobId, "failed", {
      status: "queued",
      error_message: null,
      started_at: null,
      completed_at: null,
    });
    if (!updated) throw new JobStateError();

    if (this.trigger) {
      void this.trigger.invoke().catch(() => {
        // Scheduled queue recovery handles invocation failures.
      });
    }
    return updated;
  }

  async get(jobId: string): Promise<Job> {
    const job = await this.repository.findById(jobId);
    if (!job) throw new NotFoundError("Job not found.");
    return job;
  }

  private getDeduplicationKey(payload: JobPayload): string {
    switch (payload.type) {
      case "submit_transcription":
        return `submit_transcription:${payload.segmentId}`;
      case "generate_note":
      case "index_note":
        return `${payload.type}:${payload.noteId}:${payload.sourceRevision}`;
      case "extract_attachment":
      case "index_attachment":
        return `${payload.type}:${payload.attachmentId}`;
    }
  }
}
