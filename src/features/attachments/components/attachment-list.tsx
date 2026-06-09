"use client";

import type { AttachmentListItem } from "../attachment.types";
import {
  formatAttachmentSize,
  getAttachmentStatusLabel,
  isAttachmentSearchable,
} from "../attachment-ui";

type AttachmentListProps = {
  attachments: AttachmentListItem[];
  busyAttachmentId?: string | null;
  onDelete: (attachment: AttachmentListItem) => void;
  onRetry: (attachment: AttachmentListItem) => void;
};

export function AttachmentList({
  attachments,
  busyAttachmentId,
  onDelete,
  onRetry,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return <p>No attachments yet.</p>;
  }

  return (
    <ul aria-label="Attachments">
      {attachments.map((attachment) => {
        const isBusy = busyAttachmentId === attachment.id;
        const canRetry =
          attachment.extractionStatus === "failed" ||
          attachment.extractionStatus === "uploaded" ||
          (attachment.extractionStatus === "completed" &&
            attachment.indexingStatus === "failed");

        return (
          <li key={attachment.id}>
            <div>
              <strong>{attachment.filename}</strong>
              <span>
                {" "}
                {attachment.fileType.toUpperCase()} ·{" "}
                {formatAttachmentSize(attachment.fileSizeBytes)}
              </span>
            </div>
            <div>
              <span aria-label={`Status: ${getAttachmentStatusLabel(attachment)}`}>
                {getAttachmentStatusLabel(attachment)}
              </span>
              {isAttachmentSearchable(attachment) ? (
                <span aria-label="Searchable"> Searchable</span>
              ) : null}
            </div>
            {attachment.errorMessage ? (
              <p role="alert">{attachment.errorMessage}</p>
            ) : null}
            <div>
              {canRetry ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onRetry(attachment)}
                >
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onDelete(attachment)}
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
