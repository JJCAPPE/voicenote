import { AttachmentValidationError } from "../../features/attachments/attachment.errors";
import type { AttachmentParser } from "./attachment-parser";
import { DocxAttachmentParser } from "./docx.parser";
import { PdfAttachmentParser } from "./pdf.parser";
import { PlainTextAttachmentParser } from "./plain-text.parser";

export class AttachmentParserRegistry {
  constructor(
    private readonly textParser: AttachmentParser = new PlainTextAttachmentParser(),
    private readonly pdfParser: AttachmentParser = new PdfAttachmentParser(),
    private readonly docxParser: AttachmentParser = new DocxAttachmentParser(),
  ) {}

  get(fileType: "text" | "pdf" | "docx"): AttachmentParser {
    if (fileType === "text") {
      return this.textParser;
    }

    if (fileType === "pdf") {
      return this.pdfParser;
    }

    if (fileType === "docx") {
      return this.docxParser;
    }

    throw new AttachmentValidationError(`Unsupported parser type: ${fileType}`);
  }
}
