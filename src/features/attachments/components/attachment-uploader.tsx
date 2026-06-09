"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useRef,
  useState,
} from "react";

import type { RetryAttachmentResult } from "../../../server/services/attachment.service";
import { getClientAttachmentValidationError } from "../attachment-validation";
import type {
  ActionResult,
  Attachment,
  AttachmentListItem,
  SignedUploadTarget,
} from "../attachment.types";
import { uploadToSignedUrl } from "../upload-to-signed-url";
import { AttachmentList } from "./attachment-list";

type AttachmentActions = {
  createUpload(input: {
    noteId: string;
    filename: string;
    mimeType: string;
    fileSizeBytes: number;
  }): Promise<ActionResult<SignedUploadTarget>>;
  confirmUpload(input: {
    attachmentId: string;
  }): Promise<ActionResult<Attachment>>;
  deleteAttachment(input: {
    attachmentId: string;
  }): Promise<ActionResult>;
  retryAttachment(input: {
    attachmentId: string;
  }): Promise<ActionResult<RetryAttachmentResult>>;
};

type AttachmentUploaderProps = {
  noteId: string;
  initialAttachments: AttachmentListItem[];
  actions: AttachmentActions;
};

function replaceAttachment(
  attachments: AttachmentListItem[],
  replacement: Attachment,
): AttachmentListItem[] {
  return attachments.map((attachment) =>
    attachment.id === replacement.id
      ? { ...attachment, ...replacement }
      : attachment,
  );
}

export function AttachmentUploader({
  noteId,
  initialAttachments,
  actions,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const retainedFiles = useRef(new Map<string, File>());
  const retryAttachmentId = useRef<string | null>(null);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);

  async function uploadFile(file: File) {
    const validationError = getClientAttachmentValidationError(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setProgress(0);
    const created = await actions.createUpload({
      noteId,
      filename: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });

    if (!created.ok) {
      setError(created.error);
      setProgress(null);
      return;
    }

    const target = created.data;
    retainedFiles.current.set(target.attachment.id, file);
    setAttachments((current) => [...current, target.attachment]);
    setBusyAttachmentId(target.attachment.id);

    try {
      await uploadToSignedUrl(target.signedUrl, file, setProgress);
      const confirmed = await actions.confirmUpload({
        attachmentId: target.attachment.id,
      });
      if (!confirmed.ok) {
        setError(confirmed.error);
        return;
      }
      setAttachments((current) =>
        replaceAttachment(current, confirmed.data),
      );
      retainedFiles.current.delete(target.attachment.id);
    } catch {
      setError("The upload failed. Retry keeps the same attachment record.");
    } finally {
      setBusyAttachmentId(null);
      setProgress(null);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file || busyAttachmentId) {
      return;
    }

    const retryId = retryAttachmentId.current;
    retryAttachmentId.current = null;
    if (retryId) {
      const attachment = attachments.find((item) => item.id === retryId);
      if (attachment) {
        void retryUpload(attachment, file);
        return;
      }
    }

    void uploadFile(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  async function retryUpload(attachment: AttachmentListItem, file: File) {
    const validationError = getClientAttachmentValidationError(file);
    if (
      validationError ||
      file.size !== attachment.fileSizeBytes ||
      file.type.toLowerCase() !== attachment.mimeType.toLowerCase()
    ) {
      setError(
        validationError ??
          "Select the same file that was originally uploaded.",
      );
      return;
    }

    setError(null);
    setBusyAttachmentId(attachment.id);
    const retried = await actions.retryAttachment({
      attachmentId: attachment.id,
    });

    if (!retried.ok) {
      setError(retried.error);
      setBusyAttachmentId(null);
      return;
    }

    if (retried.data.kind === "upload") {
      try {
        setProgress(0);
        await uploadToSignedUrl(retried.data.target.signedUrl, file, setProgress);
        const confirmed = await actions.confirmUpload({
          attachmentId: attachment.id,
        });
        if (!confirmed.ok) {
          setError(confirmed.error);
        } else {
          retainedFiles.current.delete(attachment.id);
          setAttachments((current) =>
            replaceAttachment(current, confirmed.data),
          );
        }
      } catch {
        setError("The upload retry failed.");
      }
    }

    setBusyAttachmentId(null);
    setProgress(null);
  }

  async function retryAttachment(attachment: AttachmentListItem) {
    const retainedFile = retainedFiles.current.get(attachment.id);
    if (attachment.extractionStatus === "uploaded" && !retainedFile) {
      retryAttachmentId.current = attachment.id;
      inputRef.current?.click();
      return;
    }

    if (retainedFile) {
      await retryUpload(attachment, retainedFile);
      return;
    }

    setError(null);
    setBusyAttachmentId(attachment.id);
    const retried = await actions.retryAttachment({
      attachmentId: attachment.id,
    });
    if (!retried.ok) {
      setError(retried.error);
    }
    setBusyAttachmentId(null);
  }

  async function deleteAttachment(attachment: AttachmentListItem) {
    setError(null);
    setBusyAttachmentId(attachment.id);
    const deleted = await actions.deleteAttachment({
      attachmentId: attachment.id,
    });

    if (deleted.ok) {
      retainedFiles.current.delete(attachment.id);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
    } else {
      setError(deleted.error);
    }
    setBusyAttachmentId(null);
  }

  return (
    <section aria-labelledby="attachments-heading">
      <h2 id="attachments-heading">Attachments</h2>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload an attachment"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        data-dragging={dragging}
      >
        <p>Drop a text, PDF, or DOCX file here, or choose a file.</p>
        <p>Maximum size: 50 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".txt,.md,.csv,.sql,.json,.yaml,.yml,.py,.ts,.tsx,.js,.jsx,.css,.html,.pdf,.docx"
        onChange={handleInputChange}
      />
      {progress !== null ? (
        <label>
          Upload progress
          <progress max={100} value={progress}>
            {progress}%
          </progress>
        </label>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <AttachmentList
        attachments={attachments}
        busyAttachmentId={busyAttachmentId}
        onDelete={(attachment) => {
          void deleteAttachment(attachment);
        }}
        onRetry={(attachment) => {
          void retryAttachment(attachment);
        }}
      />
    </section>
  );
}
