import path from "node:path";

import { AttachmentValidationError } from "./attachment.errors";

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/x-sql",
  "application/sql",
  "application/json",
  "text/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-python",
  "application/x-python-code",
  "text/typescript",
  "application/typescript",
  "text/javascript",
  "application/javascript",
  "text/css",
  "text/html",
  "application/xhtml+xml",
]);

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".sql",
  ".json",
  ".yaml",
  ".yml",
  ".py",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".html",
  ".pdf",
  ".docx",
] as const;

const EXTENSION_MIME_TYPES: Record<string, ReadonlySet<string>> = {
  ".txt": new Set(["text/plain"]),
  ".md": new Set(["text/markdown", "text/plain"]),
  ".csv": new Set(["text/csv", "text/plain", "application/vnd.ms-excel"]),
  ".sql": new Set(["text/x-sql", "application/sql", "text/plain"]),
  ".json": new Set(["application/json", "text/json", "text/plain"]),
  ".yaml": new Set([
    "application/yaml",
    "application/x-yaml",
    "text/yaml",
    "text/plain",
  ]),
  ".yml": new Set([
    "application/yaml",
    "application/x-yaml",
    "text/yaml",
    "text/plain",
  ]),
  ".py": new Set(["text/x-python", "application/x-python-code", "text/plain"]),
  ".ts": new Set(["text/typescript", "application/typescript", "text/plain"]),
  ".tsx": new Set(["text/typescript", "application/typescript", "text/plain"]),
  ".js": new Set([
    "text/javascript",
    "application/javascript",
    "text/plain",
  ]),
  ".jsx": new Set([
    "text/javascript",
    "application/javascript",
    "text/plain",
  ]),
  ".css": new Set(["text/css", "text/plain"]),
  ".html": new Set(["text/html", "application/xhtml+xml", "text/plain"]),
  ".pdf": new Set(["application/pdf"]),
  ".docx": new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
};

export type ValidatedAttachmentFile = {
  extension: string;
  fileType: "text" | "pdf" | "docx";
  mimeType: string;
};

export function getAttachmentExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function validateAttachmentMetadata(input: {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
}): ValidatedAttachmentFile {
  const extension = getAttachmentExtension(input.filename);
  const allowedMimeTypes = EXTENSION_MIME_TYPES[extension];
  const mimeType = input.mimeType.trim().toLowerCase().split(";")[0];

  if (!allowedMimeTypes) {
    throw new AttachmentValidationError(
      `Unsupported attachment extension: ${extension || "(none)"}`,
      "This file type is not supported.",
    );
  }

  if (!allowedMimeTypes.has(mimeType)) {
    throw new AttachmentValidationError(
      `MIME type ${mimeType} does not match ${extension}`,
      "The file type does not match its filename.",
    );
  }

  if (
    !Number.isSafeInteger(input.fileSizeBytes) ||
    input.fileSizeBytes <= 0 ||
    input.fileSizeBytes > MAX_ATTACHMENT_SIZE_BYTES
  ) {
    throw new AttachmentValidationError(
      `Invalid attachment size: ${input.fileSizeBytes}`,
      "Files must be larger than 0 bytes and no more than 50 MB.",
    );
  }

  return {
    extension,
    fileType:
      extension === ".pdf" ? "pdf" : extension === ".docx" ? "docx" : "text",
    mimeType,
  };
}

export function sanitizeAttachmentFilename(filename: string): string {
  const basename = path.basename(filename).normalize("NFKC");
  const extension = getAttachmentExtension(basename);
  const basenameWithoutExtension = extension
    ? basename.slice(0, -extension.length)
    : basename;
  const sanitizedStem = basenameWithoutExtension
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (!sanitizedStem) {
    throw new AttachmentValidationError(
      `Filename cannot be sanitized: ${filename}`,
      "The filename is invalid.",
    );
  }

  const maxStemLength = Math.max(1, 120 - extension.length);

  return `${sanitizedStem.slice(0, maxStemLength)}${extension}`;
}

export function buildAttachmentStoragePath(
  noteId: string,
  attachmentId: string,
  filename: string,
): string {
  return `notes/${noteId}/${attachmentId}/${sanitizeAttachmentFilename(filename)}`;
}

export function validateAttachmentBuffer(
  buffer: Buffer,
  input: { filename: string; mimeType: string },
): ValidatedAttachmentFile {
  const validated = validateAttachmentMetadata({
    ...input,
    fileSizeBytes: buffer.byteLength,
  });

  if (validated.fileType === "pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new AttachmentValidationError(
      "Invalid PDF signature",
      "The uploaded file is not a valid PDF.",
    );
  }

  if (
    validated.fileType === "docx" &&
    !(buffer[0] === 0x50 && buffer[1] === 0x4b)
  ) {
    throw new AttachmentValidationError(
      "Invalid DOCX ZIP signature",
      "The uploaded file is not a valid DOCX document.",
    );
  }

  return validated;
}

export function isTextMimeType(mimeType: string): boolean {
  return TEXT_MIME_TYPES.has(mimeType.toLowerCase().split(";")[0]);
}

export function getClientAttachmentValidationError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  try {
    validateAttachmentMetadata({
      filename: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });
    return null;
  } catch (error) {
    return error instanceof AttachmentValidationError
      ? error.publicMessage
      : "This file cannot be uploaded.";
  }
}
