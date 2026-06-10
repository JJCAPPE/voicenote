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
      <ol className="note-library-list" aria-label="Notes">
        {visibleNotes.map((note) => (
          <li key={note.id}>
            <a href={`/notes/${note.id}`}>
              <span className="note-row-title">
                <strong>{note.title}</strong>
                {note.titleOrigin === "placeholder" ? (
                  <span className="processing-label">Waiting for transcript</span>
                ) : null}
              </span>
              <span className="note-row-description">
                {note.description || "No description yet."}
              </span>
              <span className="note-row-meta">
                {note.noteType.replace("_", " ")} · Updated{" "}
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(note.updatedAt)}
              </span>
            </a>
            <button
              className="icon-button"
              aria-label={`Delete ${note.title}`}
              type="button"
              onClick={() => void remove(note.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
