"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createNoteAction,
  createQuickRecordingNoteAction,
  deleteNoteAction,
} from "@/features/notes/actions/note.actions";
import { NoteForm } from "@/features/notes/components/note-form";
import { NoteList } from "@/features/notes/components/note-list";
import type { Note } from "@/types/models";

export function DashboardClient({ initialNotes }: { initialNotes: Note[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState(initialNotes);
  const [query, setQuery] = useState("");
  const [recordPending, setRecordPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter((note) =>
      [note.title, note.description, note.noteType]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [notes, query]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [searchParams]);

  async function recordNewNote() {
    setRecordPending(true);
    setError(null);
    const result = await createQuickRecordingNoteAction();
    setRecordPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/notes/${result.data.id}?record=1`);
  }

  return (
    <div className="library-page">
      <section className="capture-launcher" aria-labelledby="capture-heading">
        <div>
          <p className="utility-label">Immediate capture</p>
          <h2 id="capture-heading">Start before the thought gets away.</h2>
          <p>
            The title and description are generated after transcription.
          </p>
        </div>
        <div className="capture-actions">
          <button
            className="record-new-button"
            type="button"
            disabled={recordPending}
            onClick={() => void recordNewNote()}
          >
            <span className="record-hardware" aria-hidden="true">
              <span />
            </span>
            <span>
              <strong>{recordPending ? "Opening recorder…" : "Record new note"}</strong>
              <small>One click to a live recording</small>
            </span>
            <kbd>R</kbd>
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => dialogRef.current?.showModal()}
          >
            Create note <kbd>N</kbd>
          </button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </section>

      <section className="library-section">
        <div className="library-toolbar">
          <div>
            <h2>All notes</h2>
            <span>{notes.length} total</span>
          </div>
          <label>
            <span className="sr-only">Search notes</span>
            <input
              type="search"
              placeholder="Search notes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <NoteList notes={visibleNotes} onDelete={deleteNoteAction} />
      </section>

      <dialog className="form-dialog" ref={dialogRef}>
        <div className="dialog-heading">
          <div>
            <p className="utility-label">New workspace</p>
            <h2>Create note</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close create note"
            onClick={() => {
              dialogRef.current?.close();
              router.replace("/dashboard");
            }}
          >
            ×
          </button>
        </div>
        <NoteForm
          onSubmit={createNoteAction}
          onSaved={(note) => {
            setNotes((current) => [note, ...current]);
            dialogRef.current?.close();
            router.push(`/notes/${note.id}`);
          }}
        />
      </dialog>
    </div>
  );
}
