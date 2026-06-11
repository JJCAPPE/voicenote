import { getServerEnvValue } from "@/lib/env";
import { handleAssemblyAIWebhook } from "@/features/transcription/server/assemblyai-webhook";
import { getTranscriptionService } from "@/server/services/factories";

export async function POST(request: Request): Promise<Response> {
  return handleAssemblyAIWebhook(
    request,
    getTranscriptionService(),
    getServerEnvValue("ASSEMBLYAI_WEBHOOK_SECRET"),
  );
}
