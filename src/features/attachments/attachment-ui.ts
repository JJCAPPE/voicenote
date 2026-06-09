import type { AttachmentListItem } from "./attachment.types";

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAttachmentSearchable(
  attachment: AttachmentListItem,
): boolean {
  return (
    attachment.extractionStatus === "completed" &&
    attachment.indexingStatus === "completed"
  );
}

export function getAttachmentStatusLabel(
  attachment: AttachmentListItem,
): string {
  if (isAttachmentSearchable(attachment)) {
    return "Searchable";
  }

  if (
    attachment.extractionStatus === "completed" &&
    attachment.indexingStatus
  ) {
    return `Indexing ${attachment.indexingStatus}`;
  }

  return `Extraction ${attachment.extractionStatus}`;
}
