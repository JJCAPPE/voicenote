import { AssemblyAITranscriptionProvider } from "@/lib/ai/assemblyai-transcription.provider";
import { getServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { JobRepository } from "@/server/repositories/job.repository";
import { NoteRepository } from "@/server/repositories/note.repository";
import { RecordingSegmentRepository } from "@/server/repositories/recording-segment.repository";
import { JobService, type JobTrigger } from "@/server/services/job.service";
import { NoteService } from "@/server/services/note.service";
import { RecordingService } from "@/server/services/recording.service";
import { SupabaseAudioStorage } from "@/server/services/storage.gateway";
import { TranscriptionService } from "@/server/services/transcription.service";

function createJobService(): JobService {
  const client = getSupabaseAdmin();
  const trigger: JobTrigger = {
    async invoke() {
      const { error } = await client.functions.invoke("process-jobs", {
        body: { limit: 5 },
      });
      if (error) throw error;
    },
  };
  return new JobService(new JobRepository(client), trigger);
}

export function getJobService(): JobService {
  return createJobService();
}

export function getNoteService(): NoteService {
  const client = getSupabaseAdmin();
  return new NoteService(new NoteRepository(client), createJobService());
}

export function getRecordingService(): RecordingService {
  const client = getSupabaseAdmin();
  return new RecordingService(
    new RecordingSegmentRepository(client),
    new SupabaseAudioStorage(client),
    createJobService(),
  );
}

export function getTranscriptionService(): TranscriptionService {
  const client = getSupabaseAdmin();
  const env = getServerEnv();
  return new TranscriptionService(
    new RecordingSegmentRepository(client),
    new NoteRepository(client),
    createJobService(),
    new SupabaseAudioStorage(client),
    new AssemblyAITranscriptionProvider(env.ASSEMBLYAI_API_KEY),
    new URL(
      "/api/webhooks/assemblyai",
      process.env.APP_URL ?? "http://localhost:3000",
    ).toString(),
    env.ASSEMBLYAI_WEBHOOK_SECRET,
  );
}
