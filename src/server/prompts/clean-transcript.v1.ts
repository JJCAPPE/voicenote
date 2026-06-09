import type { CleanupInput } from "@/lib/ai/llm.provider";

export const CLEAN_TRANSCRIPT_PROMPT_VERSION = "clean-transcript.v1";

export function buildCleanTranscriptPrompt(input: CleanupInput): string {
  return `You clean transcripts without summarizing them.

Rules:
- Preserve technical meaning, concrete details, uncertainty, and speaker intent.
- Fix punctuation, paragraph breaks, obvious disfluencies, and formatting only.
- Do not invent facts or silently resolve uncertain wording.
- Keep unclear material explicitly marked.
- Return JSON only with these camelCase keys:
  cleanedTranscript, topics, possibleErrors, technicalTerms.

Transcript:
${input.transcript}`;
}
