"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createNoteAction,
  deleteNoteAction,
} from "@/features/notes/actions/note.actions";
import { NoteForm } from "@/features/notes/components/note-form";
import { NoteList } from "@/features/notes/components/note-list";
import type { Note } from "@/types/models";

export function DashboardClient({ initialNotes }: { initialNotes: Note[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <p className="eyebrow">New note</p>
        <h2>Create a workspace</h2>
        <p className="muted">
          Start with a title. Recording and attachments are added inside the
          note.
        </p>
        <NoteForm
          onSubmit={createNoteAction}
          onSaved={(note) => {
            setNotes((current) => [note, ...current]);
            router.push(`/notes/${note.id}`);
          }}
        />
      </section>

      <section className="panel panel-wide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Your notes</h2>
          </div>
          <span className="count-badge">{notes.length}</span>
        </div>
        <NoteList notes={notes} onDelete={deleteNoteAction} />
      </section>
    </div>
  );
}
