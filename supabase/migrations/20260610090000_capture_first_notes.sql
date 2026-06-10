alter table notes
  add column if not exists live_notes text not null default '',
  add column if not exists generation_revision integer not null default 0
    check (generation_revision >= 0),
  add column if not exists title_origin text not null default 'user'
    check (title_origin in ('placeholder', 'generated', 'user')),
  add column if not exists description_origin text not null default 'placeholder'
    check (description_origin in ('placeholder', 'generated', 'user'));

update notes
set generation_revision = transcript_revision,
    title_origin = 'user',
    description_origin = case
      when nullif(trim(description), '') is null then 'placeholder'
      else 'user'
    end;

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
      generation_revision = generation_revision + 1,
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
      generation_revision = generation_revision + 1,
      updated_at = now()
  where id = p_note_id
  returning * into updated;

  if updated.id is null then
    raise exception 'note not found';
  end if;
  return updated;
end;
$$;

create or replace function save_live_notes(
  p_note_id uuid,
  p_live_notes text
) returns notes
language plpgsql
security definer
set search_path = public
as $$
declare
  updated notes;
begin
  update notes
  set live_notes = p_live_notes,
      generation_revision = case
        when live_notes is distinct from p_live_notes
          then generation_revision + 1
        else generation_revision
      end,
      updated_at = now()
  where id = p_note_id
  returning * into updated;

  if updated.id is null then
    raise exception 'note not found';
  end if;
  return updated;
end;
$$;

drop function if exists save_generated_note_outputs(
  uuid, integer, text, boolean, jsonb
);

create function save_generated_note_outputs(
  p_note_id uuid,
  p_source_revision integer,
  p_cleaned_transcript text,
  p_preserve_user_edited boolean,
  p_suggested_title text,
  p_suggested_description text,
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
  select generation_revision
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
      title = case
        when title_origin in ('placeholder', 'generated')
          then p_suggested_title
        else title
      end,
      title_origin = case
        when title_origin in ('placeholder', 'generated')
          then 'generated'
        else title_origin
      end,
      description = case
        when description_origin in ('placeholder', 'generated')
          then p_suggested_description
        else description
      end,
      description_origin = case
        when description_origin in ('placeholder', 'generated')
          then 'generated'
        else description_origin
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

revoke all on function save_live_notes(uuid, text)
  from public, anon, authenticated;
revoke all on function save_generated_note_outputs(
  uuid, integer, text, boolean, text, text, jsonb
) from public, anon, authenticated;

grant execute on function save_live_notes(uuid, text) to service_role;
grant execute on function save_generated_note_outputs(
  uuid, integer, text, boolean, text, text, jsonb
) to service_role;
