create extension if not exists vector with schema extensions;

create table if not exists generated_outputs (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  output_type text not null check (
    output_type in ('summary', 'markdown_notes', 'action_items', 'decisions', 'topics')
  ),
  content jsonb not null,
  model text not null,
  prompt_version text not null,
  source_revision integer not null check (source_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (note_id, output_type)
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  source_type text not null check (source_type in ('transcript', 'attachment')),
  source_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (nullif(trim(content), '') is not null),
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(768) not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  unique (note_id, source_type, source_id, chunk_index)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (nullif(trim(content), '') is not null),
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table chunks
  add column if not exists embedding extensions.vector(768),
  add column if not exists embedding_model text;

alter table chat_messages
  add column if not exists citations jsonb not null default '[]'::jsonb;

create index if not exists generated_outputs_note_idx
  on generated_outputs (note_id);

create index if not exists chunks_note_source_idx
  on chunks (note_id, source_type, source_id, chunk_index);

create index if not exists chat_messages_note_created_idx
  on chat_messages (note_id, created_at);

create index if not exists chunks_embedding_hnsw_idx
  on chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table generated_outputs enable row level security;
alter table chunks enable row level security;
alter table chat_messages enable row level security;

create or replace function save_generated_note_outputs(
  p_note_id uuid,
  p_source_revision integer,
  p_cleaned_transcript text,
  p_preserve_user_edited boolean,
  p_outputs jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision integer;
  output_item jsonb;
begin
  select transcript_revision
    into current_revision
    from notes
    where id = p_note_id
    for update;

  if current_revision is null or current_revision <> p_source_revision then
    return false;
  end if;

  update notes
    set cleaned_transcript = p_cleaned_transcript,
        active_transcript_version = case
          when p_preserve_user_edited then active_transcript_version
          else 'cleaned'
        end,
        updated_at = now()
    where id = p_note_id;

  for output_item in select value from jsonb_array_elements(p_outputs)
  loop
    insert into generated_outputs (
      note_id,
      output_type,
      content,
      model,
      prompt_version,
      source_revision
    )
    values (
      p_note_id,
      output_item ->> 'output_type',
      output_item -> 'content',
      output_item ->> 'model',
      output_item ->> 'prompt_version',
      p_source_revision
    )
    on conflict (note_id, output_type)
    do update set
      content = excluded.content,
      model = excluded.model,
      prompt_version = excluded.prompt_version,
      source_revision = excluded.source_revision,
      updated_at = now();
  end loop;

  return true;
end;
$$;

revoke all on function save_generated_note_outputs(
  uuid, integer, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function save_generated_note_outputs(
  uuid, integer, text, boolean, jsonb
) to service_role;

create or replace function replace_source_chunks(
  p_note_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_source_revision integer,
  p_chunks jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision integer;
  chunk_item jsonb;
begin
  if p_source_type not in ('transcript', 'attachment') then
    raise exception 'unsupported source type';
  end if;

  if p_source_type = 'transcript' then
    select transcript_revision
      into current_revision
      from notes
      where id = p_note_id
      for update;

    if current_revision is null or current_revision <> p_source_revision then
      return false;
    end if;
  end if;

  delete from chunks
    where note_id = p_note_id
      and source_type = p_source_type
      and source_id = p_source_id;

  for chunk_item in select value from jsonb_array_elements(p_chunks)
  loop
    insert into chunks (
      note_id,
      source_type,
      source_id,
      chunk_index,
      content,
      metadata,
      embedding,
      embedding_model
    )
    values (
      p_note_id,
      p_source_type,
      p_source_id,
      (chunk_item ->> 'chunk_index')::integer,
      chunk_item ->> 'content',
      coalesce(chunk_item -> 'metadata', '{}'::jsonb),
      (chunk_item -> 'embedding')::text::extensions.vector(768),
      chunk_item ->> 'embedding_model'
    );
  end loop;

  if p_source_type = 'transcript' then
    update notes
      set indexed_revision = p_source_revision,
          updated_at = now()
      where id = p_note_id;
  end if;

  return true;
end;
$$;

revoke all on function replace_source_chunks(
  uuid, text, uuid, integer, jsonb
) from public, anon, authenticated;
grant execute on function replace_source_chunks(
  uuid, text, uuid, integer, jsonb
) to service_role;

create or replace function match_chunks(
  query_embedding extensions.vector(768),
  filter_note_id uuid default null,
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  note_id uuid,
  note_title text,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    chunks.id,
    chunks.note_id,
    notes.title,
    chunks.source_type,
    chunks.source_id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  join notes on notes.id = chunks.note_id
  where chunks.embedding is not null
    and (filter_note_id is null or chunks.note_id = filter_note_id)
  order by chunks.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function match_chunks(
  extensions.vector, uuid, integer
) from public, anon, authenticated;
grant execute on function match_chunks(
  extensions.vector, uuid, integer
) to service_role;
