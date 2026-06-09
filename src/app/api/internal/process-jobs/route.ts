import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { getJobService, getTranscriptionService } from "@/server/services/factories";

function authorized(request: Request): boolean {
  const actual = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expected = getServerEnv().SUPABASE_SECRET_KEY;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const jobs = await getJobService().claimBatch(5, ["submit_transcription"]);
  const transcription = getTranscriptionService();
  const outcomes = await Promise.allSettled(
    jobs.map((job) => transcription.processSubmitJob(job)),
  );
  return Response.json({
    claimed: jobs.length,
    completed: outcomes.filter((outcome) => outcome.status === "fulfilled").length,
    failed: outcomes.filter((outcome) => outcome.status === "rejected").length,
  });
}
