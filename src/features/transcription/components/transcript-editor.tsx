"use client";

import { useCallback, useEffect, useState } from "react";
import type { TranscriptVersion } from "@/types/models";

export interface TranscriptEditorProps {
  value: string;
  version: TranscriptVersion;
  staleIndex: boolean;
  onSave: (value: string) => Promise<void>;
}

export function TranscriptEditor({
  value,
  version,
  staleIndex,
  onSave,
}: TranscriptEditorProps) {
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (pending || !draft.trim()) return;
    setPending(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }, [draft, onSave, pending]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  return (
    <section className="editor-surface transcript-editor">
      <div className="editor-status">
        <span>
          {version.replace("_", " ")}
        {staleIndex ? " (search index updating)" : ""}
        </span>
        <kbd>⌘ S</kbd>
      </div>
      <textarea
        aria-label="Transcript"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button className="editor-save" type="button" disabled={pending || !draft.trim()} onClick={save}>
        {pending ? "Saving..." : "Save transcript"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
