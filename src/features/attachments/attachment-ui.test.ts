import { describe, expect, it } from "vitest";

import type { AttachmentListItem } from "./attachment.types";
import {
  formatAttachmentSize,
  getAttachmentStatusLabel,
  isAttachmentSearchable,
} from "./attachment-ui";

const attachment: AttachmentListItem = {
  id: "attachment",
  noteId: "note",
  filename: "notes.txt",
  storagePath: "notes/note/attachment/notes.txt",
  mimeType: "text/plain",
  fileType: "text",
  fileSizeBytes: 2048,
  extractedText: "content",
  extractionStatus: "completed",
  extractionMetadata: null,
  errorMessage: null,
  createdAt: new Date("2026-06-09T00:00:00Z"),
  indexingStatus: "completed",
};

describe("attachment UI helpers", () => {
  it("marks an attachment searchable only after extraction and indexing", () => {
    expect(isAttachmentSearchable(attachment)).toBe(true);
    expect(
      isAttachmentSearchable({ ...attachment, indexingStatus: "processing" }),
    ).toBe(false);
    expect(
      isAttachmentSearchable({
        ...attachment,
        extractionStatus: "processing",
      }),
    ).toBe(false);
  });

  it("formats explicit status and size labels", () => {
    expect(formatAttachmentSize(2048)).toBe("2.0 KB");
    expect(getAttachmentStatusLabel(attachment)).toBe("Searchable");
    expect(
      getAttachmentStatusLabel({
        ...attachment,
        indexingStatus: "processing",
      }),
    ).toBe("Indexing processing");
  });
});
