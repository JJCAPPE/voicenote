import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvValue } from "@/lib/env";
import { StorageError } from "@/lib/errors";

let client: SupabaseClient | undefined;

export function getServerAdminClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      getServerEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnvValue("SUPABASE_SECRET_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return client;
}

export function mapSupabaseError(error: unknown): StorageError {
  return new StorageError("Supabase operation failed.", { cause: error });
}
