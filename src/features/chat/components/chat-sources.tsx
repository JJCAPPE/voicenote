import type { ChatSource } from "@/features/chat/chat.types";

type ChatSourcesProps = {
  sources: ChatSource[];
};

export function ChatSources({ sources }: ChatSourcesProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="answer-sources">
      <h3 id="answer-sources">Sources</h3>
      <ol>
        {sources.map((source, index) => (
          <li key={`${source.chunkId}:${index}`}>
            <strong>{source.sourceLabel}</strong>
            <blockquote>{source.quote}</blockquote>
          </li>
        ))}
      </ol>
    </section>
  );
}
