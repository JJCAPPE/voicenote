"use client";

import type { FormEvent } from "react";

type ChatInputProps = {
  value: string;
  pending?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function ChatInput({
  value,
  pending = false,
  error,
  onChange,
  onSubmit,
}: ChatInputProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="note-question">Ask this note</label>
      <textarea
        id="note-question"
        name="question"
        minLength={2}
        maxLength={2_000}
        required
        value={value}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="submit" disabled={pending || value.trim().length < 2}>
        {pending ? "Asking..." : "Ask"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
