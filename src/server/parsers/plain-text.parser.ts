import { AttachmentParseError } from "../../features/attachments/attachment.errors";
import type {
  AttachmentParseResult,
  AttachmentParser,
  ParserInput,
} from "./attachment-parser";
import { normalizeExtractedText } from "./normalize-extracted-text";

export class PlainTextAttachmentParser implements AttachmentParser {
  async parse(
    buffer: Buffer,
    _input: ParserInput,
  ): Promise<AttachmentParseResult> {
    const nulCount = buffer.reduce(
      (count, byte) => count + (byte === 0 ? 1 : 0),
      0,
    );

    if (nulCount > 0 && nulCount / buffer.length >= 0.01) {
      throw new AttachmentParseError(
        "Text attachment contains too many NUL bytes",
        "The file appears to contain binary data.",
      );
    }

    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new AttachmentParseError(
        "Text attachment is not valid UTF-8",
        "Text files must use UTF-8 encoding.",
      );
    }

    return {
      text: normalizeExtractedText(decoded),
      metadata: { encoding: "utf-8" },
    };
  }
}
