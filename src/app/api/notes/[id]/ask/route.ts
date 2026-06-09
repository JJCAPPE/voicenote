import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { AskQuestionSchema } from "@/features/chat/chat.schemas";
import { requireSession } from "@/lib/auth/session";
import { toPublicError } from "@/lib/errors";
import { getAiRuntime } from "@/server/services/ai-runtime";

const ParamsSchema = z.object({ id: z.uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession();
    const { id } = ParamsSchema.parse(await context.params);
    const input = AskQuestionSchema.parse(await request.json());
    const result = await getAiRuntime().chatService.ask(id, input.question);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const publicError =
      error instanceof ZodError
        ? { error: "The question is invalid.", code: "VALIDATION_ERROR" }
        : toPublicError(error);
    const status =
      publicError.code === "AUTHENTICATION_ERROR"
        ? 401
        : publicError.code === "VALIDATION_ERROR"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, ...publicError }, { status });
  }
}
