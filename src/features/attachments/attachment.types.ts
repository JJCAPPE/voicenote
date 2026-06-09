import type {
  ActionResult,
  Attachment,
  AttachmentStatus,
  ExtractAttachmentPayload,
  IndexAttachmentPayload,
} from "@/types/models";
import type { AttachmentRow } from "@/types/database";

export type { ActionResult, Attachment, AttachmentRow, AttachmentStatus };

export type AttachmentIndexingStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | null;

export type AttachmentListItem = Attachment & {
  indexingStatus?: AttachmentIndexingStatus;
};

export type CreateAttachmentInput = {
  id: string;
  noteId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  fileType: string;
  fileSizeBytes: number;
};

export type SignedUploadTarget = {
  attachment: Attachment;
  path: string;
  signedUrl: string;
  token: string;
};

export type AttachmentJobPayload =
  | ExtractAttachmentPayload
  | IndexAttachmentPayload;
