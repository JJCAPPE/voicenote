"use client";

import { useCallback, useEffect, useState } from "react";

type LiveNotesEditorProps = {
  value: string;
  onSave: (value: string) => Promise<void>;
};

export function LiveNotesEditor({ value, onSave }: LiveNotesEditorProps) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">(
    "saved",
  );
  const save = useCallback(async () => {
    if (status !== "dirty" && status !== "error") return;
    setStatus("saving");
    try {
      await onSave(draft);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [draft, onSave, status]);

  useEffect(() => {
    if (status !== "dirty") return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [draft, save, status]);

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
    <section className="editor-surface live-notes-editor">
      <div className="editor-status">
        <span>
          {status === "saving"
            ? "Saving…"
            : status === "error"
              ? "Save failed"
              : status === "dirty"
                ? "Unsaved"
                : "Saved"}
        </span>
        <kbd>⌘ S</kbd>
      </div>
      <textarea
        aria-label="Live notes"
        placeholder="Write alongside the recording…"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setStatus("dirty");
        }}
        onBlur={() => void save()}
      />
    </section>
  );
}
