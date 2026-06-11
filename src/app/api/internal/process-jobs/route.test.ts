import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Job, JobPayload } from "@/types/models";

const mocks = vi.hoisted(() => ({
  claimBatch: vi.fn(),
  markCompleted: vi.fn(),
  markFailed: vi.fn(),
  submitTranscription: vi.fn(),
  extractAttachment: vi.fn(),
  generate: vi.fn(),
  indexNote: vi.fn(),
  indexAttachment: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnvValue: () => "w".repeat(32),
}));
vi.mock("@/server/services/factories", () => ({
  getJobService: () => ({
    claimBatch: mocks.claimBatch,
    markCompleted: mocks.markCompleted,
    markFailed: mocks.markFailed,
  }),
  getTranscriptionService: () => ({
    submitTranscription: mocks.submitTranscription,
  }),
}));
vi.mock("@/features/attachments/attachment.runtime", () => ({
  getAttachmentService: () => ({ extract: mocks.extractAttachment }),
}));
vi.mock("@/server/services/ai-job-handlers", () => ({
  handleGenerateNoteJob: mocks.generate,
  handleIndexNoteJob: mocks.indexNote,
  handleIndexAttachmentJob: mocks.indexAttachment,
}));

import { POST } from "./route";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

function job(index: number, payload: JobPayload): Job {
  return {
    id: ids[index],
    type: payload.type,
    payload,
    status: "processing",
    deduplicationKey: `${payload.type}:${index}`,
    result: null,
    errorMessage: null,
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
  } as Job;
}

describe("process-jobs route", () => {
  beforeEach(() => {
    mocks.claimBatch.mockReset();
    mocks.markCompleted.mockReset().mockResolvedValue(undefined);
    mocks.markFailed.mockReset().mockResolvedValue(undefined);
    mocks.submitTranscription.mockReset().mockResolvedValue({ id: ids[0] });
    mocks.extractAttachment.mockReset().mockResolvedValue({ id: ids[3] });
    mocks.generate.mockReset().mockResolvedValue("generated");
    mocks.indexNote.mockReset().mockResolvedValue("indexed");
    mocks.indexAttachment.mockReset().mockRejectedValue(new Error("failed"));
  });

  it("rejects requests without the worker secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/process-jobs", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.claimBatch).not.toHaveBeenCalled();
  });

  it("dispatches every job type and isolates one failed job", async () => {
    mocks.claimBatch.mockResolvedValue([
      job(0, { type: "submit_transcription", segmentId: ids[0] }),
      job(1, { type: "generate_note", noteId: ids[1], sourceRevision: 2 }),
      job(2, { type: "index_note", noteId: ids[2], sourceRevision: 2 }),
      job(3, { type: "extract_attachment", attachmentId: ids[3] }),
      job(4, { type: "index_attachment", attachmentId: ids[4] }),
    ]);

    const response = await POST(
      new Request("http://localhost/api/internal/process-jobs", {
        method: "POST",
        headers: {
          authorization: `Bearer ${"w".repeat(32)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 5 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      claimed: 5,
      completed: 4,
      failed: 1,
    });
    expect(mocks.submitTranscription).toHaveBeenCalledWith(ids[0]);
    expect(mocks.generate).toHaveBeenCalled();
    expect(mocks.indexNote).toHaveBeenCalled();
    expect(mocks.extractAttachment).toHaveBeenCalledWith(ids[3]);
    expect(mocks.indexAttachment).toHaveBeenCalled();
    expect(mocks.markCompleted).toHaveBeenCalledTimes(4);
    expect(mocks.markFailed).toHaveBeenCalledWith(ids[4], expect.any(Error));
  });
});
