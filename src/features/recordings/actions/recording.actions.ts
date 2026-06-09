"use server";

import { requireSession } from "@/lib/auth/session";
import { toActionError } from "@/lib/errors";
import { getRecordingService } from "@/server/services/factories";
import type { ActionResult, RecordingSegment } from "@/types/models";
import type { SegmentUpload } from "@/server/services/recording.service";

export async function createSegmentAction(
  input: unknown,
): Promise<ActionResult<SegmentUpload>> {
  try {
    await requireSession();
    return {
      ok: true,
      data: await getRecordingService().createSegment(input),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function confirmSegmentUploadAction(
  input: unknown,
): Promise<ActionResult<RecordingSegment>> {
  try {
    await requireSession();
    return {
      ok: true,
      data: await getRecordingService().confirmSegmentUpload(input),
    };
  } catch (error) {
    return toActionError(error);
  }
}
