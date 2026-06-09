import { z } from "zod";

import { getAttachmentService } from "./attachment.runtime";

const extractAttachmentJobSchema = z.object({
  attachmentId: z.string().uuid(),
});

export async function handleExtractAttachmentJob(payload: unknown) {
  const parsed = extractAttachmentJobSchema.parse(payload);
  return getAttachmentService().extract(parsed.attachmentId);
}
