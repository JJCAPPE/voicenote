create table attachments (
  id uuid primary key,
  note_id uuid not null references notes(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_type text not null check (file_type in ('text', 'pdf', 'docx')),
  file_size_bytes bigint not null check (
    file_size_bytes between 1 and 52428800
  ),
  extracted_text text,
  extraction_status text not null default 'uploaded'
    check (
      extraction_status in ('uploaded', 'processing', 'completed', 'failed')
    ),
  extraction_metadata jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index attachments_note_created
  on attachments (note_id, created_at);

alter table attachments enable row level security;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update set public = false;
