import pdfParse from "pdf-parse";

import type {
  AttachmentParseResult,
  AttachmentParser,
  ParserInput,
} from "./attachment-parser";
import { normalizeExtractedText } from "./normalize-extracted-text";

type PdfExtractor = typeof pdfParse;

export class PdfAttachmentParser implements AttachmentParser {
  constructor(private readonly extractPdf: PdfExtractor = pdfParse) {}

  async parse(
    buffer: Buffer,
    _input: ParserInput,
  ): Promise<AttachmentParseResult> {
    const result = await this.extractPdf(buffer);

    return {
      text: normalizeExtractedText(result.text),
      metadata: { pageCount: result.numpages },
    };
  }
}
