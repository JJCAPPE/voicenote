"use client";

import { useState } from "react";

import { SearchForm } from "@/features/search/components/search-form";
import { SearchResults } from "@/features/search/components/search-results";
import type { SearchResult } from "@/features/search/search.types";

type SearchResponse =
  | { ok: true; data: SearchResult[] }
  | { ok: false; error: string };

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, limit: 8 }),
      });
      const result = (await response.json()) as SearchResponse;
      if (!result.ok) throw new Error(result.error);
      setResults(result.data);
      setHasSearched(true);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel search-panel">
      <SearchForm
        value={query}
        pending={pending}
        error={error}
        onChange={setQuery}
        onSubmit={search}
      />
      <SearchResults results={results} hasSearched={hasSearched} />
    </section>
  );
}
