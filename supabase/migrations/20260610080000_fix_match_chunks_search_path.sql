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
set search_path = public, extensions
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
