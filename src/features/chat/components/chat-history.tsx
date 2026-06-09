import type { ChatMessage } from "@/types/models";

type ChatHistoryProps = {
  messages: ChatMessage[];
};

export function ChatHistory({ messages }: ChatHistoryProps) {
  if (messages.length === 0) {
    return <p>No questions have been asked about this note.</p>;
  }

  return (
    <ol aria-label="Note chat history">
      {messages.map((message) => (
        <li key={message.id}>
          <article>
            <strong>{message.role === "user" ? "You" : "VoiceNote"}</strong>
            <p>{message.content}</p>
          </article>
        </li>
      ))}
    </ol>
  );
}
