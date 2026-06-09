import type { SupabaseClient } from "@supabase/supabase-js";

import { StorageError } from "@/lib/errors";
import { mapChatMessageRow } from "@/types/mappers";
import type {
  ChatCitation,
  ChatMessage,
  ChatMessageRow,
  ChatRole,
} from "@/types/models";

export class ChatMessageRepository {
  constructor(private readonly database: SupabaseClient) {}

  async create(input: {
    noteId: string;
    role: ChatRole;
    content: string;
    citations?: ChatCitation[];
  }): Promise<ChatMessage> {
    const { data, error } = await this.database
      .from("chat_messages")
      .insert({
        note_id: input.noteId,
        role: input.role,
        content: input.content,
        citations: input.citations ?? [],
      })
      .select("id, note_id, role, content, citations, created_at")
      .single();

    if (error) {
      throw new StorageError("The chat message could not be saved.", {
        cause: error,
      });
    }

    return mapChatMessageRow(data as ChatMessageRow);
  }

  async listForNote(noteId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.database
      .from("chat_messages")
      .select("id, note_id, role, content, citations, created_at")
      .eq("note_id", noteId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new StorageError("Chat history could not be loaded.", {
        cause: error,
      });
    }

    return ((data ?? []) as ChatMessageRow[]).map(mapChatMessageRow);
  }
}
