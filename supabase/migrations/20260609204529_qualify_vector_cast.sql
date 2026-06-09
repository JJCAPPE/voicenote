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
