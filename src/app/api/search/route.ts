import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/session";
import { toPublicError } from "@/lib/errors";
import { SearchRequestSchema } from "@/features/search/search.schemas";
import { getAiRuntime } from "@/server/services/ai-runtime";

export async function POST(request: Request) {
  try {
    await requireSession();
    const input = SearchRequestSchema.parse(await request.json());
    const results = await getAiRuntime().searchService.search(input.query, {
      noteId: input.noteId,
      limit: input.limit,
    });
    return NextResponse.json({ ok: true, data: results });
  } catch (error) {
    const publicError =
      error instanceof ZodError
        ? { error: "The search request is invalid.", code: "VALIDATION_ERROR" }
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
