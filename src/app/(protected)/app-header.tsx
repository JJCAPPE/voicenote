"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { logoutAction } from "@/features/auth/auth.actions";
import { createQuickRecordingNoteAction } from "@/features/notes/actions/note.actions";
import { ShortcutDialog } from "@/features/shortcuts/shortcut-dialog";
import {
  hasOpenDialog,
  isModifierShortcut,
  isTypingTarget,
} from "@/features/shortcuts/shortcuts";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const shortcutDialogRef = useRef<HTMLDialogElement>(null);
  const [recordPending, setRecordPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recordNewNote() {
    if (recordPending) return;
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isModifierShortcut(event, "/")) {
        event.preventDefault();
        shortcutDialogRef.current?.showModal();
        return;
      }
      if (isModifierShortcut(event, "k")) {
        event.preventDefault();
        router.push("/search?focus=1");
        return;
      }
      if (pathname.startsWith("/notes/") || isTypingTarget(event.target)) return;
      if (hasOpenDialog()) return;
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        void recordNewNote();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/dashboard?new=1");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <>
      <header className="app-header">
        <Link className="brand" href="/dashboard" prefetch={false}>
          VoiceNote
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link
            aria-current={pathname === "/dashboard" ? "page" : undefined}
            href="/dashboard"
            prefetch={false}
          >
            Notes
          </Link>
          <Link
            aria-current={pathname === "/search" ? "page" : undefined}
            href="/search"
          >
            Search
          </Link>
        </nav>
        <div className="header-actions">
          <button
            className="header-record-button"
            type="button"
            disabled={recordPending}
            onClick={() => void recordNewNote()}
          >
            <span className="record-dot" aria-hidden="true" />
            {recordPending ? "Creating…" : "Record new"}
            <kbd>R</kbd>
          </button>
          <button
            className="key-button"
            type="button"
            aria-label="Keyboard shortcuts"
            onClick={() => shortcutDialogRef.current?.showModal()}
          >
            ⌘ /
          </button>
          <form action={logoutAction}>
            <button className="quiet-button" type="submit">
              Log out
            </button>
          </form>
        </div>
        {error ? <p className="header-error" role="alert">{error}</p> : null}
      </header>
      <ShortcutDialog dialogRef={shortcutDialogRef} />
    </>
  );
}
