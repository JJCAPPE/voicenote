import type { ChatCitation, ChatMessage } from "@/types/models";

export type ChatSource = ChatCitation & {
  sourceLabel: string;
  excerpt: string;
};

export type AskQuestionResult = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  insufficientContext: boolean;
  sources: ChatSource[];
};
