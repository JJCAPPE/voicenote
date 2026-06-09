"use server";

import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { toActionError } from "@/lib/errors";
import { getAttachmentPublicError } from "./attachment.errors";
import {
  confirmAttachmentUploadSchema,
  createAttachmentUploadSchema,
  deleteAttachmentSchema,
  retryAttachmentSchema,
} from "./attachment.schemas";
import type {
  ActionResult,
  Attachment,
  SignedUploadTarget,
} from "./attachment.types";
import type {
  RetryAttachmentResult,
} from "../../server/services/attachment.service";
import { getAttachmentService } from "./attachment.runtime";

async function runAction<T>(
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        code: "ATTACHMENT_VALIDATION",
        error: error.issues[0]?.message ?? "Invalid attachment request.",
      };
    }

    const mapped = getAttachmentPublicError(error);
    if (mapped.code !== "ATTACHMENT_ERROR") {
      return { ok: false, code: mapped.code, error: mapped.message };
    }
    return toActionError(error);
  }
}

export async function createAttachmentUploadAction(
  input: unknown,
): Promise<ActionResult<SignedUploadTarget>> {
  return runAction(async () => {
    await requireSession();
    return getAttachmentService().createUpload(
      createAttachmentUploadSchema.parse(input),
    );
  });
}

export async function confirmAttachmentUploadAction(
  input: unknown,
): Promise<ActionResult<Attachment>> {
  return runAction(async () => {
    await requireSession();
    const parsed = confirmAttachmentUploadSchema.parse(input);
    return getAttachmentService().confirmUpload(parsed.attachmentId);
  });
}

export async function deleteAttachmentAction(
  input: unknown,
): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const parsed = deleteAttachmentSchema.parse(input);
    await getAttachmentService().delete(parsed.attachmentId);
    return undefined;
  });
}

export async function retryAttachmentAction(
  input: unknown,
): Promise<ActionResult<RetryAttachmentResult>> {
  return runAction(async () => {
    await requireSession();
    const parsed = retryAttachmentSchema.parse(input);
    return getAttachmentService().retry(parsed.attachmentId);
  });
}
