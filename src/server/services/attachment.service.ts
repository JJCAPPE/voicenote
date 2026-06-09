import { randomUUID } from "node:crypto";

import type {
  AttachmentJobQueue,
  AttachmentRepositoryContract,
  AttachmentStorage,
} from "../../features/attachments/attachment.contracts";
import {
  AttachmentNotFoundError,
  AttachmentStateError,
  AttachmentValidationError,
  getAttachmentPublicError,
} from "../../features/attachments/attachment.errors";
import {
  buildAttachmentStoragePath,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAttachmentBuffer,
  validateAttachmentMetadata,
} from "../../features/attachments/attachment-validation";
import type {
  Attachment,
  SignedUploadTarget,
} from "../../features/attachments/attachment.types";
import { AttachmentParserRegistry } from "../parsers/attachment-parser.registry";

export type RetryAttachmentResult =
  | { kind: "upload"; target: SignedUploadTarget }
  | { kind: "extraction"; attachment: Attachment }
  | { kind: "indexing"; attachment: Attachment };

export class AttachmentService {
  constructor(
    private readonly repository: AttachmentRepositoryContract,
    private readonly storage: AttachmentStorage,
    private readonly jobs: AttachmentJobQueue,
    private readonly parsers = new AttachmentParserRegistry(),
    private readonly createId: () => string = randomUUID,
  ) {}

  listForNote(noteId: string): Promise<Attachment[]> {
    return this.repository.listForNote(noteId);
  }

  async createUpload(input: {
    noteId: string;
    filename: string;
    mimeType: string;
    fileSizeBytes: number;
  }): Promise<SignedUploadTarget> {
    const validated = validateAttachmentMetadata(input);
    const id = this.createId();
    const storagePath = buildAttachmentStoragePath(
      input.noteId,
      id,
      input.filename,
    );
    const attachment = await this.repository.createPending({
      id,
      noteId: input.noteId,
      filename: storagePath.slice(storagePath.lastIndexOf("/") + 1),
      storagePath,
      mimeType: validated.mimeType,
      fileType: validated.fileType,
      fileSizeBytes: input.fileSizeBytes,
    });
    const signedUpload = await this.storage.createSignedUpload(storagePath);

    return {
      attachment,
      ...signedUpload,
    };
  }

  async confirmUpload(attachmentId: string): Promise<Attachment> {
    const attachment = await this.requireAttachment(attachmentId);

    if (attachment.extractionStatus !== "uploaded") {
      throw new AttachmentStateError(
        `Cannot confirm attachment in ${attachment.extractionStatus}`,
      );
    }

    const actualSize = await this.storage.getSize(attachment.storagePath);
    if (
      actualSize <= 0 ||
      actualSize > MAX_ATTACHMENT_SIZE_BYTES ||
      actualSize !== attachment.fileSizeBytes
    ) {
      throw new AttachmentValidationError(
        `Stored size ${actualSize} does not match claimed size ${attachment.fileSizeBytes}`,
        "The uploaded file size does not match the selected file.",
      );
    }

    await this.jobs.enqueue({
      type: "extract_attachment",
      attachmentId: attachment.id,
    });
    return attachment;
  }

  async extract(attachmentId: string): Promise<Attachment> {
    const attachment = await this.requireAttachment(attachmentId);

    if (
      attachment.extractionStatus === "completed" &&
      attachment.extractedText?.trim()
    ) {
      await this.enqueueIndexing(attachment.id);
      return attachment;
    }

    if (
      attachment.extractionStatus !== "uploaded" &&
      attachment.extractionStatus !== "failed"
    ) {
      throw new AttachmentStateError(
        `Cannot extract attachment in ${attachment.extractionStatus}`,
      );
    }

    await this.repository.markProcessing(attachment.id);
    let completed: Attachment | null = null;

    try {
      const buffer = await this.storage.download(attachment.storagePath);
      const validated = validateAttachmentBuffer(buffer, {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
      });
      const parser = this.parsers.get(validated.fileType);
      const parsed = await parser.parse(buffer, {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        extension: validated.extension,
      });

      completed = await this.repository.markCompleted(
        attachment.id,
        parsed.text,
        parsed.metadata,
      );
      await this.enqueueIndexing(attachment.id);
      return completed;
    } catch (error) {
      if (completed) {
        throw error;
      }

      const publicError = getAttachmentPublicError(error);
      await this.repository.markFailed(attachment.id, publicError.message);
      throw error;
    }
  }

  async retry(attachmentId: string): Promise<RetryAttachmentResult> {
    const attachment = await this.requireAttachment(attachmentId);

    if (attachment.extractionStatus === "uploaded") {
      const signedUpload = await this.storage.createSignedUpload(
        attachment.storagePath,
      );
      return {
        kind: "upload",
        target: { attachment, ...signedUpload },
      };
    }

    if (attachment.extractionStatus === "failed") {
      await this.jobs.enqueue({
        type: "extract_attachment",
        attachmentId: attachment.id,
      });
      return { kind: "extraction", attachment };
    }

    if (
      attachment.extractionStatus === "completed" &&
      attachment.extractedText?.trim()
    ) {
      await this.enqueueIndexing(attachment.id);
      return { kind: "indexing", attachment };
    }

    throw new AttachmentStateError(
      `Cannot retry attachment in ${attachment.extractionStatus}`,
    );
  }

  async delete(attachmentId: string): Promise<void> {
    const attachment = await this.requireAttachment(attachmentId);

    await this.storage.remove(attachment.storagePath);
    await this.repository.delete(attachment.id);
  }

  private async requireAttachment(attachmentId: string): Promise<Attachment> {
    const attachment = await this.repository.findById(attachmentId);
    if (!attachment) {
      throw new AttachmentNotFoundError();
    }
    return attachment;
  }

  private async enqueueIndexing(attachmentId: string): Promise<void> {
    await this.jobs.enqueue({ type: "index_attachment", attachmentId });
  }
}
