import { hash } from "bcryptjs";
import { vi } from "vitest";

export async function setValidServerEnv() {
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("APP_PASSWORD_HASH", await hash("correct-password", 4));
  vi.stubEnv("SESSION_SECRET", "a".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  vi.stubEnv("SUPABASE_SECRET_KEY", "secret-key");
  vi.stubEnv("ASSEMBLYAI_API_KEY", "assembly-key");
  vi.stubEnv("ASSEMBLYAI_WEBHOOK_SECRET", "assembly-webhook-secret");
  vi.stubEnv("GEMINI_API_KEY", "gemini-key");
  vi.stubEnv("JOB_WORKER_SECRET", "j".repeat(32));
}
