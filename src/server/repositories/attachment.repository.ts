import type { SupabaseClient } from "@supabase/supabase-js";

import { mapAttachmentRow } from "@/types/mappers";
import type { AttachmentRepositoryContract } from "../../features/attachments/attachment.contracts";
import { AttachmentError } from "../../features/attachments/attachment.errors";
import {
  type Attachment,
  type AttachmentRow,
  type CreateAttachmentInput,
} from "../../features/attachments/attachment.types";

function repositoryError(operation: string, error: { message: string }): AttachmentError {
  return new AttachmentError(
    `${operation}: ${error.message}`,
    "ATTACHMENT_REPOSITORY",
    "The attachment data could not be updated.",
  );
}

export class AttachmentRepository implements AttachmentRepositoryContract {
  constructor(private readonly client: SupabaseClient) {}

  async listForNote(noteId: string): Promise<Attachment[]> {
    const { data, error } = await this.client
      .from("attachments")
      .select("*")
      .eq("note_id", noteId)
      .order("created_at", { ascending: true });

    if (error) {
      throw repositoryError("List attachments", error);
    }

    return ((data ?? []) as AttachmentRow[]).map(mapAttachmentRow);
  }

  async findById(id: string): Promise<Attachment | null> {
    const { data, error } = await this.client
      .from("attachments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw repositoryError("Find attachment", error);
    }

    return data ? mapAttachmentRow(data as AttachmentRow) : null;
  }

  async createPending(input: CreateAttachmentInput): Promise<Attachment> {
    const { data, error } = await this.client
      .from("attachments")
      .insert({
        id: input.id,
        note_id: input.noteId,
        filename: input.filename,
        storage_path: input.storagePath,
        mime_type: input.mimeType,
        file_type: input.fileType,
        file_size_bytes: input.fileSizeBytes,
        extraction_status: "uploaded",
      })
      .select("*")
      .single();

    if (error || !data) {
      throw repositoryError(
        "Create attachment",
        error ?? { message: "No row returned" },
      );
    }

    return mapAttachmentRow(data as AttachmentRow);
  }

  async markProcessing(id: string): Promise<Attachment> {
    return this.update(id, {
      extraction_status: "processing",
      error_message: null,
    });
  }

  async markCompleted(
    id: string,
    text: string,
    metadata: Record<string, unknown>,
  ): Promise<Attachment> {
    return this.update(id, {
      extraction_status: "completed",
      extracted_text: text,
      extraction_metadata: metadata,
      error_message: null,
    });
  }

  async markFailed(id: string, message: string): Promise<Attachment> {
    return this.update(id, {
      extraction_status: "failed",
      error_message: message,
    });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("attachments").delete().eq("id", id);

    if (error) {
      throw repositoryError("Delete attachment", error);
    }
  }

  private async update(
    id: string,
    values: Record<string, unknown>,
  ): Promise<Attachment> {
    const { data, error } = await this.client
      .from("attachments")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw repositoryError(
        "Update attachment",
        error ?? { message: "No row returned" },
      );
    }

    return mapAttachmentRow(data as AttachmentRow);
  }
}
