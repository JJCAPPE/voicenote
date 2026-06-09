"use client";

import { useState } from "react";
import type { ActionResult, Note } from "@/types/models";

export interface NoteListProps {
  notes: Note[];
  onDelete: (input: { id: string }) => Promise<ActionResult>;
}

export function NoteList({ notes, onDelete }: NoteListProps) {
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<string[]>([]);

  async function remove(id: string) {
    const result = await onDelete({ id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeleted((current) => [...current, id]);
  }

  const visibleNotes = notes.filter((note) => !deleted.includes(note.id));
  if (visibleNotes.length === 0) return <p>No notes yet.</p>;

  return (
    <>
      <ul>
        {visibleNotes.map((note) => (
          <li key={note.id}>
            <a href={`/notes/${note.id}`}>{note.title}</a>
            <button type="button" onClick={() => void remove(note.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
