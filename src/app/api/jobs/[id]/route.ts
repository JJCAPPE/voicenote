import { requireSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { JobIdSchema } from "@/features/jobs/schemas/job.schema";
import { getJobService } from "@/server/services/factories";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireSession();
    const parsed = JobIdSchema.safeParse(await context.params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid job ID." }, { status: 400 });
    }
    return Response.json(await getJobService().get(parsed.data.id));
  } catch (error) {
    const status = error instanceof AppError ? 400 : 500;
    return Response.json(
      { error: error instanceof AppError ? error.publicMessage : "Request failed." },
      { status },
    );
  }
}
