import type { SummaryInput } from "@/lib/ai/llm.provider";

export const SUMMARIZE_NOTE_PROMPT_VERSION = "summarize-note.v2";

export function buildSummarizeNotePrompt(input: SummaryInput): string {
  const segmentCatalog = input.segments
    .map((segment) => `${segment.id}: ${segment.label}`)
    .join("\n");
  const liveNotes = input.liveNotes.trim();

  return `Create structured notes using only the supplied transcript and optional live notes.

Rules:
- Do not invent facts, owners, dates, decisions, or source segment IDs.
- suggestedTitle must be concise, specific, and at most 80 characters.
- suggestedDescription must be one concise sentence and at most 240 characters.
- Use null for an unknown action-item owner or due date.
- sourceSegmentIds may contain only IDs from the segment catalog.
- Return JSON only with these camelCase keys:
  suggestedTitle, suggestedDescription, shortSummary, longSummary,
  markdownNotes, actionItems, decisions, topics.

Segment catalog:
${segmentCatalog || "(no segment metadata)"}

Live notes:
${liveNotes || "(none)"}

Cleaned transcript:
${input.cleanedTranscript}`;
}
