"use client";

import { useState } from "react";
import type { ActionResult, Note, NoteType } from "@/types/models";

export interface NoteFormProps {
  note?: Note;
  onSubmit: (input: {
    id?: string;
    title?: string;
    description?: string | null;
    noteType?: NoteType;
  }) => Promise<ActionResult<Note>>;
  onSaved?: (note: Note) => void;
}

export function NoteForm({ note, onSubmit, onSaved }: NoteFormProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [description, setDescription] = useState(note?.description ?? "");
  const [noteType, setNoteType] = useState<NoteType>(note?.noteType ?? "other");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const normalizedDescription = description.trim() || null;
    const result = await onSubmit(
      note
        ? {
            id: note.id,
            ...(title.trim() !== note.title ? { title } : {}),
            ...(normalizedDescription !== note.description
              ? { description: normalizedDescription }
              : {}),
            ...(noteType !== note.noteType ? { noteType } : {}),
          }
        : {
            title,
            description: normalizedDescription,
            noteType,
          },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved?.(result.data);
  }

  return (
    <form onSubmit={submit}>
      <label>
        Title
        <input
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        Type
        <select
          value={noteType}
          onChange={(event) => setNoteType(event.target.value as NoteType)}
        >
          {["meeting", "lecture", "office_hours", "project", "personal", "other"].map(
            (value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ),
          )}
        </select>
      </label>
      <button disabled={pending}>{pending ? "Saving..." : "Save note"}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
