import type {
  Attachment,
  AttachmentJobPayload,
  CreateAttachmentInput,
} from "./attachment.types";

export interface AttachmentRepositoryContract {
  listForNote(noteId: string): Promise<Attachment[]>;
  findById(id: string): Promise<Attachment | null>;
  createPending(input: CreateAttachmentInput): Promise<Attachment>;
  markProcessing(id: string): Promise<Attachment>;
  markCompleted(
    id: string,
    text: string,
    metadata: Record<string, unknown>,
  ): Promise<Attachment>;
  markFailed(id: string, message: string): Promise<Attachment>;
  delete(id: string): Promise<void>;
}

export interface AttachmentStorage {
  createSignedUpload(path: string): Promise<{
    path: string;
    signedUrl: string;
    token: string;
  }>;
  getSize(path: string): Promise<number>;
  download(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
}

export interface AttachmentJobQueue {
  enqueue(payload: AttachmentJobPayload): Promise<unknown>;
}

export type RequireSession = () => Promise<void>;
