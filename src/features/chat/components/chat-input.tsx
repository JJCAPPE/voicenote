"use client";

import { type FormEvent, useEffect, useRef } from "react";

type ChatInputProps = {
  value: string;
  pending?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  focusRequest?: number;
};

export function ChatInput({
  value,
  pending = false,
  error,
  onChange,
  onSubmit,
  focusRequest = 0,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusRequest > 0) textareaRef.current?.focus();
  }, [focusRequest]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="note-question">Ask this note</label>
      <textarea
        ref={textareaRef}
        id="note-question"
        name="question"
        minLength={2}
        maxLength={2_000}
        required
        value={value}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey) &&
            !pending &&
            value.trim().length >= 2
          ) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      />
      <button type="submit" disabled={pending || value.trim().length < 2}>
        {pending ? "Asking..." : "Ask"} <kbd>⌘ ↵</kbd>
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
