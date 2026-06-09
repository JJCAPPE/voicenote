import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AttachmentJobQueue,
  AttachmentRepositoryContract,
  AttachmentStorage,
} from "../../features/attachments/attachment.contracts";
import { AttachmentStateError } from "../../features/attachments/attachment.errors";
import type { Attachment } from "../../features/attachments/attachment.types";
import type { AttachmentParser } from "../parsers/attachment-parser";
import { AttachmentParserRegistry } from "../parsers/attachment-parser.registry";
import { AttachmentService } from "./attachment.service";

const baseAttachment: Attachment = {
  id: "11111111-1111-4111-8111-111111111111",
  noteId: "22222222-2222-4222-8222-222222222222",
  filename: "notes.txt",
  storagePath:
    "notes/22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/notes.txt",
  mimeType: "text/plain",
  fileType: "text",
  fileSizeBytes: 11,
  extractedText: null,
  extractionStatus: "uploaded",
  extractionMetadata: null,
  errorMessage: null,
  createdAt: new Date("2026-06-09T00:00:00Z"),
};

function createMocks() {
  const repository: AttachmentRepositoryContract = {
    listForNote: vi.fn(),
    findById: vi.fn().mockResolvedValue(baseAttachment),
    createPending: vi.fn().mockResolvedValue(baseAttachment),
    markProcessing: vi
      .fn()
      .mockResolvedValue({ ...baseAttachment, extractionStatus: "processing" }),
    markCompleted: vi.fn().mockImplementation((_id, text, metadata) => ({
      ...baseAttachment,
      extractedText: text,
      extractionMetadata: metadata,
      extractionStatus: "completed",
    })),
    markFailed: vi.fn().mockImplementation((_id, message) => ({
      ...baseAttachment,
      extractionStatus: "failed",
      errorMessage: message,
    })),
    delete: vi.fn(),
  };
  const storage: AttachmentStorage = {
    createSignedUpload: vi.fn().mockResolvedValue({
      path: baseAttachment.storagePath,
      signedUrl: "https://storage.example/upload",
      token: "token",
    }),
    getSize: vi.fn().mockResolvedValue(baseAttachment.fileSizeBytes),
    download: vi.fn().mockResolvedValue(Buffer.from("Hello world")),
    remove: vi.fn(),
  };
  const jobs: AttachmentJobQueue = {
    enqueue: vi.fn(),
  };
  const parser: AttachmentParser = {
    parse: vi.fn().mockResolvedValue({
      text: "Hello world",
      metadata: { encoding: "utf-8" },
    }),
  };
  const parsers = new AttachmentParserRegistry(parser, parser, parser);
  const service = new AttachmentService(
    repository,
    storage,
    jobs,
    parsers,
    () => baseAttachment.id,
  );

  return { repository, storage, jobs, parser, service };
}

describe("AttachmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a stable row before requesting a signed upload", async () => {
    const { repository, storage, service } = createMocks();

    await service.createUpload({
      noteId: baseAttachment.noteId,
      filename: "../../notes.txt",
      mimeType: "text/plain",
      fileSizeBytes: 11,
    });

    expect(repository.createPending).toHaveBeenCalledWith({
      id: baseAttachment.id,
      noteId: baseAttachment.noteId,
      filename: "notes.txt",
      storagePath: baseAttachment.storagePath,
      mimeType: "text/plain",
      fileType: "text",
      fileSizeBytes: 11,
    });
    expect(storage.createSignedUpload).toHaveBeenCalledAfter(
      repository.createPending as ReturnType<typeof vi.fn>,
    );
  });

  it("confirms actual size before enqueueing extraction", async () => {
    const { jobs, service } = createMocks();
    await service.confirmUpload(baseAttachment.id);
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "extract_attachment",
      attachmentId: baseAttachment.id,
    });
  });

  it("rejects a stored size mismatch without enqueueing", async () => {
    const { storage, jobs, service } = createMocks();
    vi.mocked(storage.getSize).mockResolvedValue(10);

    await expect(service.confirmUpload(baseAttachment.id)).rejects.toThrow(
      "does not match claimed size",
    );
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("persists extracted text before enqueueing indexing", async () => {
    const events: string[] = [];
    const { repository, jobs, service } = createMocks();
    vi.mocked(repository.markCompleted).mockImplementation(
      async (_id, text, metadata) => {
        events.push("persist");
        return {
          ...baseAttachment,
          extractionStatus: "completed",
          extractedText: text,
          extractionMetadata: metadata,
        };
      },
    );
    vi.mocked(jobs.enqueue).mockImplementation(async () => {
      events.push("enqueue");
    });

    const result = await service.extract(baseAttachment.id);

    expect(result.extractionStatus).toBe("completed");
    expect(events).toEqual(["persist", "enqueue"]);
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "index_attachment",
      attachmentId: baseAttachment.id,
    });
  });

  it("marks download or parse failures failed and retains storage", async () => {
    const { repository, storage, service } = createMocks();
    vi.mocked(storage.download).mockRejectedValue(new Error("private failure"));

    await expect(service.extract(baseAttachment.id)).rejects.toThrow(
      "private failure",
    );
    expect(repository.markFailed).toHaveBeenCalledWith(
      baseAttachment.id,
      "The attachment request could not be completed.",
    );
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("does not mark completed extraction failed if indexing enqueue fails", async () => {
    const { repository, jobs, service } = createMocks();
    vi.mocked(jobs.enqueue).mockRejectedValue(new Error("queue unavailable"));

    await expect(service.extract(baseAttachment.id)).rejects.toThrow(
      "queue unavailable",
    );
    expect(repository.markCompleted).toHaveBeenCalled();
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("retries completed extraction by ensuring only the indexing job", async () => {
    const { repository, storage, parser, jobs, service } = createMocks();
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseAttachment,
      extractionStatus: "completed",
      extractedText: "Already extracted",
    });

    await service.extract(baseAttachment.id);

    expect(storage.download).not.toHaveBeenCalled();
    expect(parser.parse).not.toHaveBeenCalled();
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "index_attachment",
      attachmentId: baseAttachment.id,
    });
  });

  it("retries a failed attachment without creating a row or object", async () => {
    const { repository, storage, jobs, service } = createMocks();
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseAttachment,
      extractionStatus: "failed",
    });

    await service.retry(baseAttachment.id);

    expect(repository.createPending).not.toHaveBeenCalled();
    expect(storage.createSignedUpload).not.toHaveBeenCalled();
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "extract_attachment",
      attachmentId: baseAttachment.id,
    });
  });

  it("rejects an illegal processing transition", async () => {
    const { repository, service } = createMocks();
    vi.mocked(repository.findById).mockResolvedValue({
      ...baseAttachment,
      extractionStatus: "processing",
    });

    await expect(service.extract(baseAttachment.id)).rejects.toBeInstanceOf(
      AttachmentStateError,
    );
  });

  it("deletes storage before the database row", async () => {
    const events: string[] = [];
    const { repository, storage, service } = createMocks();
    vi.mocked(storage.remove).mockImplementation(async () => {
      events.push("storage");
    });
    vi.mocked(repository.delete).mockImplementation(async () => {
      events.push("database");
    });

    await service.delete(baseAttachment.id);
    expect(events).toEqual(["storage", "database"]);
  });

  it("does not delete the row when storage deletion fails", async () => {
    const { repository, storage, service } = createMocks();
    vi.mocked(storage.remove).mockRejectedValue(new Error("storage failure"));

    await expect(service.delete(baseAttachment.id)).rejects.toThrow(
      "storage failure",
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("surfaces a database deletion failure only after storage removal", async () => {
    const { repository, storage, service } = createMocks();
    vi.mocked(repository.delete).mockRejectedValue(new Error("database failure"));

    await expect(service.delete(baseAttachment.id)).rejects.toThrow(
      "database failure",
    );
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });
});
