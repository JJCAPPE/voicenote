import { describe, expect, it, vi } from "vitest";

import { AttachmentParseError } from "../../features/attachments/attachment.errors";
import { DocxAttachmentParser } from "./docx.parser";
import { normalizeExtractedText } from "./normalize-extracted-text";
import { PdfAttachmentParser } from "./pdf.parser";
import { PlainTextAttachmentParser } from "./plain-text.parser";

const parserInput = {
  filename: "file.txt",
  mimeType: "text/plain",
  extension: ".txt",
};

describe("attachment parsers", () => {
  it("decodes UTF-8 and normalizes line endings and blank lines", async () => {
    const parser = new PlainTextAttachmentParser();
    await expect(
      parser.parse(Buffer.from(" First\r\n\r\n\r\nSecond \r\n"), parserInput),
    ).resolves.toEqual({
      text: "First\n\nSecond",
      metadata: { encoding: "utf-8" },
    });
  });

  it("rejects binary and invalid UTF-8 text", async () => {
    const parser = new PlainTextAttachmentParser();

    await expect(
      parser.parse(Buffer.from([0, 0, 65, 66]), parserInput),
    ).rejects.toBeInstanceOf(AttachmentParseError);
    await expect(
      parser.parse(Buffer.from([0xc3, 0x28]), parserInput),
    ).rejects.toThrow("valid UTF-8");
  });

  it("returns PDF page count", async () => {
    const extractPdf = vi.fn().mockResolvedValue({
      numpages: 3,
      numrender: 3,
      info: {},
      metadata: null,
      version: "default",
      text: "Page one\r\n\r\n\r\nPage two",
    });
    const parser = new PdfAttachmentParser(extractPdf);

    await expect(
      parser.parse(Buffer.from("%PDF-"), {
        ...parserInput,
        filename: "file.pdf",
        mimeType: "application/pdf",
        extension: ".pdf",
      }),
    ).resolves.toEqual({
      text: "Page one\n\nPage two",
      metadata: { pageCount: 3 },
    });
  });

  it("returns DOCX warnings without exposing extractor error objects", async () => {
    const extractRawText = vi.fn().mockResolvedValue({
      value: "Document text",
      messages: [
        { type: "warning", message: "Unsupported element" },
        {
          type: "error",
          message: "Image skipped",
          error: new Error("private detail"),
        },
      ],
    });
    const parser = new DocxAttachmentParser(extractRawText);

    await expect(
      parser.parse(Buffer.from([0x50, 0x4b]), {
        ...parserInput,
        filename: "file.docx",
        extension: ".docx",
      }),
    ).resolves.toEqual({
      text: "Document text",
      metadata: {
        warnings: [
          { type: "warning", message: "Unsupported element" },
          { type: "error", message: "Image skipped" },
        ],
      },
    });
  });

  it("rejects empty extraction", () => {
    expect(() => normalizeExtractedText(" \r\n \n")).toThrow(
      "no meaningful text",
    );
    expect(() => normalizeExtractedText("---")).toThrow(
      "no meaningful text",
    );
  });
});
