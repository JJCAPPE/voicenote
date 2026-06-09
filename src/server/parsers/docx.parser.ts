import mammoth from "mammoth";

import type {
  AttachmentParseResult,
  AttachmentParser,
  ParserInput,
} from "./attachment-parser";
import { normalizeExtractedText } from "./normalize-extracted-text";

type DocxExtractor = typeof mammoth.extractRawText;

export class DocxAttachmentParser implements AttachmentParser {
  constructor(
    private readonly extractRawText: DocxExtractor = mammoth.extractRawText,
  ) {}

  async parse(
    buffer: Buffer,
    _input: ParserInput,
  ): Promise<AttachmentParseResult> {
    const result = await this.extractRawText({ buffer });

    return {
      text: normalizeExtractedText(result.value),
      metadata: {
        warnings: result.messages.map((message) => ({
          type: message.type,
          message: message.message,
        })),
      },
    };
  }
}
