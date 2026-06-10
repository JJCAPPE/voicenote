import type { SupabaseClient } from "@supabase/supabase-js";

import { StorageError } from "@/lib/errors";
import type { GeneratedOutputType } from "@/types/models";

export type GeneratedOutputWrite = {
  outputType: GeneratedOutputType;
  content: Record<string, unknown>;
  model: string;
  promptVersion: string;
  sourceRevision: number;
};

export type SaveGeneratedNoteInput = {
  noteId: string;
  sourceRevision: number;
  cleanedTranscript: string;
  preserveUserEditedTranscript: boolean;
  suggestedTitle: string;
  suggestedDescription: string;
  outputs: GeneratedOutputWrite[];
};

export class GeneratedOutputRepository {
  constructor(private readonly database: SupabaseClient) {}

  async saveGeneratedNote(input: SaveGeneratedNoteInput): Promise<boolean> {
    const { data, error } = await this.database.rpc(
      "save_generated_note_outputs",
      {
        p_note_id: input.noteId,
        p_source_revision: input.sourceRevision,
        p_cleaned_transcript: input.cleanedTranscript,
        p_preserve_user_edited: input.preserveUserEditedTranscript,
        p_suggested_title: input.suggestedTitle,
        p_suggested_description: input.suggestedDescription,
        p_outputs: input.outputs.map((output) => ({
          output_type: output.outputType,
          content: output.content,
          model: output.model,
          prompt_version: output.promptVersion,
          source_revision: output.sourceRevision,
        })),
      },
    );

    if (error) {
      throw new StorageError("Generated note outputs could not be saved.", {
        cause: error,
      });
    }

    return data === true;
  }
}
