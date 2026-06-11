import "server-only";

import { z } from "zod";

import { ValidationError } from "@/lib/errors";

const ServerEnvSchema = z.object({
  APP_URL: z
    .url()
    .refine((value) => value.startsWith("http://") || value.startsWith("https://")),
  APP_PASSWORD_HASH: z
    .string()
    .regex(/^\$2[aby]\$\d{2}\$.{53}$/, "Must be a bcrypt password hash."),
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_SUPABASE_URL: z
    .url()
    .refine((value) => value.startsWith("http://") || value.startsWith("https://")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ASSEMBLYAI_API_KEY: z.string().min(1),
  ASSEMBLYAI_WEBHOOK_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  JOB_WORKER_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function getServerEnvValue<K extends keyof ServerEnv>(
  key: K,
): ServerEnv[K] {
  const schema = ServerEnvSchema.shape[key] as z.ZodType<ServerEnv[K]>;
  const parsed = schema.safeParse(process.env[key]);
  if (!parsed.success) {
    throw new ValidationError("Server configuration is invalid.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function getServerEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new ValidationError("Server configuration is invalid.", {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
