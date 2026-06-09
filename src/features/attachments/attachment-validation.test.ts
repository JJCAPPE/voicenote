import { describe, expect, it } from "vitest";

import {
  buildAttachmentStoragePath,
  getClientAttachmentValidationError,
  MAX_ATTACHMENT_SIZE_BYTES,
  sanitizeAttachmentFilename,
  validateAttachmentBuffer,
  validateAttachmentMetadata,
} from "./attachment-validation";

describe("attachment validation", () => {
  it("accepts supported extension and MIME combinations", () => {
    expect(
      validateAttachmentMetadata({
        filename: "query.sql",
        mimeType: "text/plain",
        fileSizeBytes: 42,
      }),
    ).toMatchObject({ extension: ".sql", fileType: "text" });

    expect(
      validateAttachmentMetadata({
        filename: "notes.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 42,
      }),
    ).toMatchObject({ extension: ".pdf", fileType: "pdf" });
  });

  it("rejects unsupported, mismatched, empty, and oversized files", () => {
    expect(() =>
      validateAttachmentMetadata({
        filename: "archive.zip",
        mimeType: "application/zip",
        fileSizeBytes: 42,
      }),
    ).toThrow("Unsupported attachment extension");

    expect(() =>
      validateAttachmentMetadata({
        filename: "notes.pdf",
        mimeType: "text/plain",
        fileSizeBytes: 42,
      }),
    ).toThrow("does not match");

    expect(() =>
      validateAttachmentMetadata({
        filename: "notes.txt",
        mimeType: "text/plain",
        fileSizeBytes: 0,
      }),
    ).toThrow("Invalid attachment size");

    expect(() =>
      validateAttachmentMetadata({
        filename: "notes.txt",
        mimeType: "text/plain",
        fileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1,
      }),
    ).toThrow("Invalid attachment size");
  });

  it("sanitizes filenames and builds a stable scoped path", () => {
    expect(sanitizeAttachmentFilename("../../Quarterly notes (final).PDF")).toBe(
      "Quarterly-notes-final.pdf",
    );
    expect(
      buildAttachmentStoragePath(
        "note-id",
        "attachment-id",
        "../../Quarterly notes (final).PDF",
      ),
    ).toBe(
      "notes/note-id/attachment-id/Quarterly-notes-final.pdf",
    );
  });

  it("checks PDF and DOCX signatures", () => {
    expect(() =>
      validateAttachmentBuffer(Buffer.from("not a pdf"), {
        filename: "file.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrow("Invalid PDF signature");

    expect(() =>
      validateAttachmentBuffer(Buffer.from("not a docx"), {
        filename: "file.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toThrow("Invalid DOCX ZIP signature");

    expect(
      validateAttachmentBuffer(Buffer.from("%PDF-1.7\n"), {
        filename: "file.pdf",
        mimeType: "application/pdf",
      }).fileType,
    ).toBe("pdf");
    expect(
      validateAttachmentBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04]), {
        filename: "file.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).fileType,
    ).toBe("docx");
  });

  it("returns client-safe validation messages", () => {
    expect(
      getClientAttachmentValidationError({
        name: "image.png",
        type: "image/png",
        size: 100,
      }),
    ).toBe("This file type is not supported.");
    expect(
      getClientAttachmentValidationError({
        name: "large.txt",
        type: "text/plain",
        size: MAX_ATTACHMENT_SIZE_BYTES + 1,
      }),
    ).toContain("50 MB");
  });
});
