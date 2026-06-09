import type { SummaryInput } from "@/lib/ai/llm.provider";

export const SUMMARIZE_NOTE_PROMPT_VERSION = "summarize-note.v1";

export function buildSummarizeNotePrompt(input: SummaryInput): string {
  const segmentCatalog = input.segments
    .map((segment) => `${segment.id}: ${segment.label}`)
    .join("\n");

  return `Create structured notes using only the supplied transcript.

Rules:
- Do not invent facts, owners, dates, decisions, or source segment IDs.
- Use null for an unknown action-item owner or due date.
- sourceSegmentIds may contain only IDs from the segment catalog.
- Return JSON only with these camelCase keys:
  shortSummary, longSummary, markdownNotes, actionItems, decisions, topics.

Segment catalog:
${segmentCatalog || "(no segment metadata)"}

Cleaned transcript:
${input.cleanedTranscript}`;
}
