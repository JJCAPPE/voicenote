import "dotenv/config";

import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configured) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");

  const parsed = new URL(configured);
  if (parsed.hostname.startsWith("db.")) {
    const projectRef = parsed.hostname.split(".")[1];
    return `https://${projectRef}.supabase.co`;
  }
  return configured;
}

const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required.");

export const admin = createClient(getSupabaseUrl(), secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function createFixtureNote(input?: {
  transcriptRevision?: number;
  indexedRevision?: number;
  rawTranscript?: string;
}) {
  const title = `E2E Note ${crypto.randomUUID()}`;
  const { data, error } = await admin
    .from("notes")
    .insert({
      title,
      description: "Controlled browser-test fixture",
      note_type: "meeting",
      raw_combined_transcript: input?.rawTranscript ?? null,
      transcript_revision: input?.transcriptRevision ?? 0,
      indexed_revision: input?.indexedRevision ?? 0,
    })
    .select("id,title")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFixtureNote(noteId: string) {
  const { error } = await admin.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}
