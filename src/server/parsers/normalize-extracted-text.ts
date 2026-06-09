import { AttachmentParseError } from "../../features/attachments/attachment.errors";

export function normalizeExtractedText(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!/\p{L}|\p{N}/u.test(normalized)) {
    throw new AttachmentParseError(
      "Extraction produced no meaningful text",
      "No readable text was found in the file.",
    );
  }

  return normalized;
}
