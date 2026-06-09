import type { SupabaseClient } from "@supabase/supabase-js";

import { AttachmentStorageError } from "./attachment.errors";
import type { AttachmentStorage } from "./attachment.contracts";

const ATTACHMENT_BUCKET = "attachments";

function splitStoragePath(storagePath: string): {
  directory: string;
  filename: string;
} {
  const separator = storagePath.lastIndexOf("/");
  return {
    directory: storagePath.slice(0, separator),
    filename: storagePath.slice(separator + 1),
  };
}

export class SupabaseAttachmentStorage implements AttachmentStorage {
  constructor(private readonly client: SupabaseClient) {}

  async createSignedUpload(path: string): Promise<{
    path: string;
    signedUrl: string;
    token: string;
  }> {
    const { data, error } = await this.client.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new AttachmentStorageError(
        error?.message ?? "Storage did not return a signed upload URL",
        "The upload could not be prepared.",
      );
    }

    return {
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
    };
  }

  async getSize(path: string): Promise<number> {
    const { directory, filename } = splitStoragePath(path);
    const { data, error } = await this.client.storage
      .from(ATTACHMENT_BUCKET)
      .list(directory, { search: filename, limit: 2 });

    if (error) {
      throw new AttachmentStorageError(error.message);
    }

    const object = data.find((item) => item.name === filename);
    const size = object?.metadata?.size;

    if (!object || typeof size !== "number") {
      throw new AttachmentStorageError(
        `Storage object not found: ${path}`,
        "The uploaded file was not found.",
      );
    }

    return size;
  }

  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(ATTACHMENT_BUCKET)
      .download(path);

    if (error || !data) {
      throw new AttachmentStorageError(error?.message ?? "Storage returned no file");
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(ATTACHMENT_BUCKET)
      .remove([path]);

    if (error) {
      throw new AttachmentStorageError(
        error.message,
        "The attachment could not be deleted.",
      );
    }
  }
}
