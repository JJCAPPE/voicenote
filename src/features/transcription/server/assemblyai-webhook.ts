import { timingSafeEqual } from "node:crypto";
import { AssemblyAIWebhookSchema } from "@/features/transcription/schemas/webhook.schema";
import type { TranscriptionService } from "@/server/services/transcription.service";

function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function handleAssemblyAIWebhook(
  request: Request,
  service: TranscriptionService,
  expectedSecret: string,
): Promise<Response> {
  const actualSecret = request.headers.get("x-assemblyai-webhook-secret");
  if (!secretsMatch(actualSecret, expectedSecret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = AssemblyAIWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    const result = await service.handleCompletedCallback(
      parsed.data.transcript_id,
    );
    return Response.json({ ok: true, status: result.status });
  } catch {
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
