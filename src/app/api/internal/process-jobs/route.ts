import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getAttachmentService } from "@/features/attachments/attachment.runtime";
import { getServerEnvValue } from "@/lib/env";
import { getJobService, getTranscriptionService } from "@/server/services/factories";
import {
  handleGenerateNoteJob,
  handleIndexAttachmentJob,
  handleIndexNoteJob,
} from "@/server/services/ai-job-handlers";
import type { Job } from "@/types/models";

const WorkerRequestSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
});

function authorized(request: Request): boolean {
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expected = getServerEnvValue("JOB_WORKER_SECRET");
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function dispatch(job: Job): Promise<unknown> {
  switch (job.payload.type) {
    case "submit_transcription":
      return getTranscriptionService().submitTranscription(job.payload.segmentId);
    case "generate_note":
      return handleGenerateNoteJob(job.payload);
    case "index_note":
      return handleIndexNoteJob(job.payload);
    case "extract_attachment":
      return getAttachmentService().extract(job.payload.attachmentId);
    case "index_attachment":
      return handleIndexAttachmentJob(job.payload);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = WorkerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid worker request." }, { status: 400 });
  }

  const jobs = await getJobService().claimBatch(parsed.data.limit);
  const outcomes = await Promise.all(
    jobs.map(async (job) => {
      try {
        const result = await dispatch(job);
        await getJobService().markCompleted(job.id, result);
        return "completed" as const;
      } catch (error) {
        try {
          await getJobService().markFailed(job.id, error);
        } catch {
          // The next recovery run can reconcile an interrupted transition.
        }
        return "failed" as const;
      }
    }),
  );

  return Response.json({
    claimed: jobs.length,
    completed: outcomes.filter((outcome) => outcome === "completed").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  });
}
