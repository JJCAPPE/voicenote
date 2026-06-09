import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AttachmentRepository } from "@/server/repositories/attachment.repository";
import { AttachmentService } from "@/server/services/attachment.service";
import { getJobService } from "@/server/services/factories";

import { SupabaseAttachmentStorage } from "./supabase-attachment.storage";

let service: AttachmentService | undefined;

export function getAttachmentService(): AttachmentService {
  if (!service) {
    const client = getSupabaseAdmin();
    service = new AttachmentService(
      new AttachmentRepository(client),
      new SupabaseAttachmentStorage(client),
      getJobService(),
    );
  }

  return service;
}
