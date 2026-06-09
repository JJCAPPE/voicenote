"use client";

import { useState } from "react";
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

  async function save() {
    setPending(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <p>
        Version: {version}
        {staleIndex ? " (search index updating)" : ""}
      </p>
      <textarea
        aria-label="Transcript"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={20}
      />
      <button type="button" disabled={pending || !draft.trim()} onClick={save}>
        {pending ? "Saving..." : "Save transcript"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
