import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationNames = [
  "20260609000000_initial_schema.sql",
  "20260609010000_attachments.sql",
  "20260609030000_ai_generation_search_chat.sql",
  "20260609201137_final_integration.sql",
  "20260609202615_advisor_cleanup.sql",
];

const migrations = migrationNames.map((name) =>
  readFileSync(resolve("supabase/migrations", name), "utf8"),
);
const combined = migrations.join("\n");

describe("ordered migration contract", () => {
  it("keeps fixed enums, private buckets, and RLS", () => {
    for (const jobType of [
      "submit_transcription",
      "generate_note",
      "index_note",
      "extract_attachment",
      "index_attachment",
    ]) {
      expect(combined).toContain(`'${jobType}'`);
    }
    expect(combined).toContain("alter table notes enable row level security");
    expect(combined).toContain("alter table attachments enable row level security");
    expect(combined).toContain("values ('audio-temp', 'audio-temp', false)");
    expect(combined).toContain("values ('attachments', 'attachments', false)");
  });

  it("repairs vector and citation columns created before the AI migration", () => {
    expect(combined).toContain(
      "add column if not exists embedding extensions.vector(768)",
    );
    expect(combined).toContain(
      "add column if not exists citations jsonb not null",
    );
    expect(combined).toContain(
      "filter_note_id is null or chunks.note_id = filter_note_id",
    );
    expect(combined).toContain("create or replace function replace_source_chunks");
    expect(combined).toContain(
      "(chunk_item -> 'embedding')::text::extensions.vector(768)",
    );
  });

  it("secures privileged RPCs and enables recovery extensions", () => {
    expect(combined).toContain(
      "create extension if not exists pg_net with schema extensions",
    );
    expect(combined).toContain(
      "create extension if not exists pg_cron with schema pg_catalog",
    );
    expect(combined).toContain(
      "revoke all on function create_recording_segment",
    );
    expect(combined).toContain(
      "grant execute on function list_note_jobs(uuid) to service_role",
    );
    expect(combined).toContain("create trigger delete_note_jobs");
    expect(combined).not.toMatch(/https:\/\/[a-z0-9-]+\.supabase\.co/);
  });
});
