import type { SupabaseClient } from "@supabase/supabase-js";
import { StorageError } from "@/lib/errors";

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

export interface AudioStorage {
  createSignedUpload(path: string): Promise<SignedUpload>;
  verifyObject(path: string, expectedSize: number): Promise<void>;
  createSignedDownload(path: string, expiresInSeconds: number): Promise<string>;
  deleteObject(path: string): Promise<void>;
}

export class SupabaseAudioStorage implements AudioStorage {
  private readonly bucket;

  constructor(client: SupabaseClient) {
    this.bucket = client.storage.from("audio-temp");
  }

  async createSignedUpload(path: string): Promise<SignedUpload> {
    const { data, error } = await this.bucket.createSignedUploadUrl(path);
    if (error) throw new StorageError("Could not create upload URL.", { cause: error });
    return { path, token: data.token, signedUrl: data.signedUrl };
  }

  async verifyObject(path: string, expectedSize: number): Promise<void> {
    const { data, error } = await this.bucket.info(path);
    if (error || !data) {
      throw new StorageError("Uploaded audio was not found.", { cause: error });
    }
    if (Number(data.size) !== expectedSize) {
      throw new StorageError("Uploaded audio size does not match.");
    }
  }

  async createSignedDownload(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.bucket.createSignedUrl(path, expiresInSeconds);
    if (error) {
      throw new StorageError("Could not create audio download URL.", { cause: error });
    }
    return data.signedUrl;
  }

  async deleteObject(path: string): Promise<void> {
    const { error } = await this.bucket.remove([path]);
    if (error) throw new StorageError("Transcript saved, but audio cleanup failed.");
  }
}
