create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table chunks
  add column if not exists embedding extensions.vector(768),
  add column if not exists embedding_model text;

alter table chat_messages
  add column if not exists citations jsonb not null default '[]'::jsonb;

create index if not exists chunks_embedding_hnsw_idx
  on chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create or replace function list_note_jobs(p_note_id uuid)
returns setof jobs
language sql
stable
security definer
set search_path = public
as $$
  select jobs.*
  from jobs
  where payload ->> 'noteId' = p_note_id::text
    or exists (
      select 1
      from recording_segments
      where recording_segments.note_id = p_note_id
        and recording_segments.id::text = jobs.payload ->> 'segmentId'
    )
    or exists (
      select 1
      from attachments
      where attachments.note_id = p_note_id
        and attachments.id::text = jobs.payload ->> 'attachmentId'
    )
  order by jobs.created_at desc;
$$;

create or replace function delete_attachment_chunks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from chunks
  where source_type = 'attachment'
    and source_id = old.id;
  return old;
end;
$$;

drop trigger if exists delete_attachment_chunks on attachments;
create trigger delete_attachment_chunks
before delete on attachments
for each row execute function delete_attachment_chunks();

create or replace function delete_note_jobs()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from jobs
  where payload ->> 'noteId' = old.id::text
    or payload ->> 'segmentId' in (
      select id::text from recording_segments where note_id = old.id
    )
    or payload ->> 'attachmentId' in (
      select id::text from attachments where note_id = old.id
    );
  return old;
end;
$$;

drop trigger if exists delete_note_jobs on notes;
create trigger delete_note_jobs
before delete on notes
for each row execute function delete_note_jobs();

revoke all on function create_recording_segment(
  uuid, uuid, text, text, text, bigint, integer
) from public, anon, authenticated;
revoke all on function rebuild_note_raw_transcript(uuid)
  from public, anon, authenticated;
revoke all on function save_edited_transcript(uuid, text)
  from public, anon, authenticated;
revoke all on function claim_jobs(integer, text[])
  from public, anon, authenticated;
revoke all on function save_generated_note_outputs(
  uuid, integer, text, boolean, jsonb
) from public, anon, authenticated;
revoke all on function replace_source_chunks(
  uuid, text, uuid, integer, jsonb
) from public, anon, authenticated;
revoke all on function match_chunks(extensions.vector, uuid, integer)
  from public, anon, authenticated;
revoke all on function list_note_jobs(uuid)
  from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on table notes, recording_segments, attachments, jobs, chunks,
  generated_outputs, chat_messages to service_role;
grant execute on function create_recording_segment(
  uuid, uuid, text, text, text, bigint, integer
) to service_role;
grant execute on function rebuild_note_raw_transcript(uuid) to service_role;
grant execute on function save_edited_transcript(uuid, text) to service_role;
grant execute on function claim_jobs(integer, text[]) to service_role;
grant execute on function save_generated_note_outputs(
  uuid, integer, text, boolean, jsonb
) to service_role;
grant execute on function replace_source_chunks(
  uuid, text, uuid, integer, jsonb
) to service_role;
grant execute on function match_chunks(extensions.vector, uuid, integer)
  to service_role;
grant execute on function list_note_jobs(uuid) to service_role;
