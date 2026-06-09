import { describe, expect, it, vi } from "vitest";
import { JobStateError, ValidationError } from "@/lib/errors";
import type { JobRepository } from "@/server/repositories/job.repository";
import { JobService } from "@/server/services/job.service";
import type { Job, JobStatus } from "@/types/models";

const jobId = "11111111-1111-4111-8111-111111111111";
const noteId = "22222222-2222-4222-8222-222222222222";

function job(status: JobStatus, attempts = 1): Job {
  return {
    id: jobId,
    type: "index_note",
    status,
    payload: { type: "index_note", noteId, sourceRevision: 2 },
    deduplicationKey: `index_note:${noteId}:2`,
    result: null,
    errorMessage: null,
    attempts,
    maxAttempts: 3,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
  };
}

function serviceWith(current: Job) {
  const repository = {
    findById: vi.fn(async () => current),
    updateStatus: vi.fn(async (_id, _expected, values) => ({
      ...current,
      ...values,
    })),
  };
  return {
    repository,
    service: new JobService(repository as unknown as JobRepository),
  };
}

describe("JobService", () => {
  it("deduplicates active work by source and revision", async () => {
    const existing = job("queued");
    const repository = {
      findActiveByKey: vi.fn(async () => existing),
      insert: vi.fn(),
    };
    const service = new JobService(repository as unknown as JobRepository);

    await expect(
      service.enqueue({
        type: "index_note",
        noteId,
        sourceRevision: 2,
      }),
    ).resolves.toBe(existing);
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.findActiveByKey).toHaveBeenCalledWith(
      `index_note:${noteId}:2`,
    );
  });

  it("rejects malformed payloads", async () => {
    const service = new JobService({} as JobRepository);
    await expect(
      service.enqueue({ type: "index_note", noteId, sourceRevision: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("completes only processing jobs and repeated completion is a no-op", async () => {
    const processing = serviceWith(job("processing"));
    await processing.service.markCompleted(jobId, { ok: true });
    expect(processing.repository.updateStatus).toHaveBeenCalledWith(
      jobId,
      "processing",
      expect.objectContaining({ status: "completed", result: { ok: true } }),
    );

    const completed = serviceWith(job("completed"));
    await completed.service.markCompleted(jobId);
    expect(completed.repository.updateStatus).not.toHaveBeenCalled();

    for (const status of ["queued", "failed"] as const) {
      await expect(serviceWith(job(status)).service.markCompleted(jobId)).rejects.toBeInstanceOf(
        JobStateError,
      );
    }
  });

  it("fails only processing jobs", async () => {
    const processing = serviceWith(job("processing"));
    await processing.service.markFailed(jobId, new Error("provider failed"));
    expect(processing.repository.updateStatus).toHaveBeenCalledWith(
      jobId,
      "processing",
      expect.objectContaining({
        status: "failed",
        error_message: "provider failed",
      }),
    );

    for (const status of ["queued", "completed", "failed"] as const) {
      await expect(serviceWith(job(status)).service.markFailed(jobId, "x")).rejects.toBeInstanceOf(
        JobStateError,
      );
    }
  });

  it("retries only failed jobs below max attempts", async () => {
    const failed = serviceWith(job("failed"));
    await expect(failed.service.retry(jobId)).resolves.toEqual(
      expect.objectContaining({ status: "queued" }),
    );

    await expect(
      serviceWith(job("failed", 3)).service.retry(jobId),
    ).rejects.toBeInstanceOf(JobStateError);
    for (const status of ["queued", "processing", "completed"] as const) {
      await expect(serviceWith(job(status)).service.retry(jobId)).rejects.toBeInstanceOf(
        JobStateError,
      );
    }
  });

  it("validates claim batch limits", async () => {
    const service = new JobService({ claimBatch: vi.fn() } as unknown as JobRepository);
    await expect(service.claimBatch(0)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.claimBatch(101)).rejects.toBeInstanceOf(ValidationError);
  });
});
