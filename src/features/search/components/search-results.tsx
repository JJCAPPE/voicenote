import type { SearchResult } from "@/features/search/search.types";

type SearchResultsProps = {
  results: SearchResult[];
  hasSearched?: boolean;
};

export function SearchResults({
  results,
  hasSearched = false,
}: SearchResultsProps) {
  if (results.length === 0) {
    return hasSearched ? <p>No matching note context was found.</p> : null;
  }

  return (
    <ol aria-label="Search results">
      {results.map((result) => (
        <li key={result.chunkId}>
          <a href={`/notes/${result.noteId}`}>
            <article>
              <header>
                <strong>{result.noteTitle}</strong>
                <span>
                  {result.sourceType === "attachment"
                    ? `Attachment: ${result.sourceLabel}`
                    : "Transcript"}
                </span>
              </header>
              <p>{result.excerpt}</p>
              <small>Similarity: {Math.round(result.similarity * 100)}%</small>
            </article>
          </a>
        </li>
      ))}
    </ol>
  );
}
