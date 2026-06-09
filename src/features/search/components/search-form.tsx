"use client";

import type { FormEvent } from "react";

type SearchFormProps = {
  value: string;
  pending?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function SearchForm({
  value,
  pending = false,
  error,
  onChange,
  onSubmit,
}: SearchFormProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="semantic-search">Search notes and attachments</label>
      <div>
        <input
          id="semantic-search"
          name="query"
          type="search"
          minLength={2}
          maxLength={500}
          required
          value={value}
          disabled={pending}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" disabled={pending || value.trim().length < 2}>
          {pending ? "Searching..." : "Search"}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
