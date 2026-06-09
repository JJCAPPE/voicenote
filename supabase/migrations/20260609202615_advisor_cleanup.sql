drop index if exists chunks_note_source_idx;
drop index if exists chat_messages_note_created_idx;

alter extension vector set schema extensions;

drop extension if exists pg_net;
create extension pg_net with schema extensions;
