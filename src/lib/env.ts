import "server-only";

import { z } from "zod";

import { ValidationError } from "@/lib/errors";

const ServerEnvSchema = z.object({
  APP_PASSWORD_HASH: z
    .string()
    .regex(/^\$2[aby]\$\d{2}\$.{53}$/, "Must be a bcrypt password hash."),
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ASSEMBLYAI_API_KEY: z.string().min(1),
  ASSEMBLYAI_WEBHOOK_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new ValidationError("Server configuration is invalid.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
