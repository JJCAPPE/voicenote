create extension if not exists pgcrypto;

create table notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  note_type text not null default 'other'
    check (note_type in ('meeting', 'lecture', 'office_hours', 'project', 'personal', 'other')),
  raw_combined_transcript text,
  cleaned_transcript text,
  user_edited_transcript text,
  active_transcript_version text not null default 'raw'
    check (active_transcript_version in ('raw', 'cleaned', 'user_edited')),
  transcript_revision integer not null default 0 check (transcript_revision >= 0),
  indexed_revision integer not null default 0 check (indexed_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recording_segments (
  id uuid primary key,
  note_id uuid not null references notes(id) on delete cascade,
  segment_index integer not null check (segment_index >= 1),
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type like 'audio/%'),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 524288000),
  duration_seconds integer not null check (duration_seconds >= 0),
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'uploaded', 'transcribing', 'completed', 'failed')),
  external_provider text,
  external_job_id text unique,
  raw_transcript text,
  transcript_json jsonb,
  speaker_labels jsonb,
  audio_deleted boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (note_id, segment_index)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (
    job_type in ('submit_transcription', 'generate_note', 'index_note', 'extract_attachment', 'index_attachment')
  ),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  payload jsonb not null,
  deduplication_key text not null,
  result jsonb,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  source_type text not null
    check (source_type in ('transcript', 'attachment')),
  source_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (nullif(trim(content), '') is not null),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (nullif(trim(content), '') is not null),
  created_at timestamptz not null default now()
);

create unique index jobs_active_deduplication_key
  on jobs (deduplication_key)
  where status in ('queued', 'processing');

create index recording_segments_note_order
  on recording_segments (note_id, segment_index);

create index chunks_note_source
  on chunks (note_id, source_type, source_id, chunk_index);

create index chat_messages_note_created
  on chat_messages (note_id, created_at);

alter table notes enable row level security;
alter table recording_segments enable row level security;
alter table jobs enable row level security;
alter table chunks enable row level security;
alter table chat_messages enable row level security;

insert into storage.buckets (id, name, public)
values ('audio-temp', 'audio-temp', false)
on conflict (id) do update set public = false;

create or replace function create_recording_segment(
  p_id uuid,
  p_note_id uuid,
  p_original_filename text,
  p_extension text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_duration_seconds integer
) returns recording_segments
language plpgsql
security definer
set search_path = public
as $$
declare
  next_index integer;
  created recording_segments;
begin
  perform 1 from notes where id = p_note_id for update;
  if not found then
    raise exception 'note not found';
  end if;

  select coalesce(max(segment_index), 0) + 1
    into next_index
    from recording_segments
    where note_id = p_note_id;

  insert into recording_segments (
    id, note_id, segment_index, original_filename, storage_path,
    mime_type, file_size_bytes, duration_seconds
  ) values (
    p_id, p_note_id, next_index, p_original_filename,
    format('notes/%s/segments/%s.%s', p_note_id, p_id, p_extension),
    p_mime_type, p_file_size_bytes, p_duration_seconds
  ) returning * into created;

  return created;
end;
$$;

create or replace function rebuild_note_raw_transcript(p_note_id uuid)
returns notes
language plpgsql
security definer
set search_path = public
as $$
declare
  combined text;
  updated notes;
begin
  select string_agg(
    format('## Segment %s%s%s', segment_index, E'\n\n', trim(raw_transcript)),
    E'\n\n'
    order by segment_index
  )
  into combined
  from recording_segments
  where note_id = p_note_id
    and status = 'completed'
    and nullif(trim(raw_transcript), '') is not null;

  update notes
  set raw_combined_transcript = coalesce(combined, ''),
      transcript_revision = transcript_revision + 1,
      updated_at = now()
  where id = p_note_id
  returning * into updated;

  if updated.id is null then
    raise exception 'note not found';
  end if;
  return updated;
end;
$$;

create or replace function save_edited_transcript(
  p_note_id uuid,
  p_transcript text
) returns notes
language plpgsql
security definer
set search_path = public
as $$
declare
  updated notes;
begin
  if nullif(trim(p_transcript), '') is null then
    raise exception 'transcript cannot be blank';
  end if;

  update notes
  set user_edited_transcript = p_transcript,
      active_transcript_version = 'user_edited',
      transcript_revision = transcript_revision + 1,
      updated_at = now()
  where id = p_note_id
  returning * into updated;

  if updated.id is null then
    raise exception 'note not found';
  end if;
  return updated;
end;
$$;

create or replace function claim_jobs(p_limit integer, p_types text[] default null)
returns setof jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from jobs
    where status = 'queued'
      and (p_types is null or job_type = any(p_types))
    order by created_at
    for update skip locked
    limit greatest(p_limit, 0)
  )
  update jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      started_at = now(),
      error_message = null
  from claimed
  where j.id = claimed.id
  returning j.*;
end;
$$;
