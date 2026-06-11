import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { toPublicError } from "@/lib/errors";
import { getTranscriptionService } from "@/server/services/factories";

const ParamsSchema = z.object({ id: z.uuid() });

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireSession();
    const params = ParamsSchema.parse(await context.params);
    return Response.json(
      await getTranscriptionService().syncTranscription(params.id),
    );
  } catch (error) {
    return Response.json(toPublicError(error), { status: 400 });
  }
}
