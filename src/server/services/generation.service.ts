import type { LLMProvider } from "@/lib/ai/llm.provider";
import { NotFoundError, ProviderError, ValidationError } from "@/lib/errors";
import type {
  GeneratedOutputRepository,
  GeneratedOutputWrite,
} from "@/server/repositories/generated-output.repository";
import type {
  AiSourceRepository,
  GenerationSource,
} from "@/server/repositories/ai-source.repository";
import { SUMMARIZE_NOTE_PROMPT_VERSION } from "@/server/prompts/summarize-note.v2";

export type GenerationResult = "generated" | "stale";

export interface GenerationJobQueue {
  enqueue(input: {
    type: "index_note";
    noteId: string;
    sourceRevision: number;
  }): Promise<unknown>;
}

export class GenerationService {
  constructor(
    private readonly sourceRepository: Pick<
      AiSourceRepository,
      "getGenerationSource"
    >,
    private readonly outputRepository: Pick<
      GeneratedOutputRepository,
      "saveGeneratedNote"
    >,
    private readonly jobQueue: GenerationJobQueue,
    private readonly llm: LLMProvider,
  ) {}

  async generateNote(
    noteId: string,
    sourceRevision: number,
  ): Promise<GenerationResult> {
    const source = await this.sourceRepository.getGenerationSource(noteId);
    if (!source) {
      throw new NotFoundError("The note was not found.");
    }
    if (source.sourceRevision !== sourceRevision) {
      return "stale";
    }

    const transcript = source.transcript.trim();
    if (!transcript) {
      throw new ValidationError("The note has no active transcript to generate.");
    }

    const cleanup = await this.llm.cleanTranscript({ transcript });
    const summary = await this.llm.summarizeNote({
      cleanedTranscript: cleanup.cleanedTranscript,
      liveNotes: source.liveNotes,
      segments: source.segments.map((segment) => ({
        id: segment.id,
        label: segment.label,
      })),
    });
    validateSegmentReferences(source, summary);

    const saved = await this.outputRepository.saveGeneratedNote({
      noteId,
      sourceRevision,
      cleanedTranscript: cleanup.cleanedTranscript,
      preserveUserEditedTranscript:
        source.activeTranscriptVersion === "user_edited",
      suggestedTitle: summary.suggestedTitle,
      suggestedDescription: summary.suggestedDescription,
      outputs: buildOutputs(summary, this.llm.model, sourceRevision),
    });
    if (!saved) {
      return "stale";
    }

    await this.jobQueue.enqueue({
      type: "index_note",
      noteId,
      sourceRevision: source.transcriptRevision,
    });
    return "generated";
  }
}

function buildOutputs(
  summary: Awaited<ReturnType<LLMProvider["summarizeNote"]>>,
  model: string,
  sourceRevision: number,
): GeneratedOutputWrite[] {
  const metadata = {
    model,
    promptVersion: SUMMARIZE_NOTE_PROMPT_VERSION,
    sourceRevision,
  };

  return [
    {
      outputType: "summary",
      content: {
        shortSummary: summary.shortSummary,
        longSummary: summary.longSummary,
      },
      ...metadata,
    },
    {
      outputType: "markdown_notes",
      content: { markdown: summary.markdownNotes },
      ...metadata,
    },
    {
      outputType: "action_items",
      content: { items: summary.actionItems },
      ...metadata,
    },
    {
      outputType: "decisions",
      content: { items: summary.decisions },
      ...metadata,
    },
    {
      outputType: "topics",
      content: { topics: summary.topics },
      ...metadata,
    },
  ];
}

function validateSegmentReferences(
  source: GenerationSource,
  summary: Awaited<ReturnType<LLMProvider["summarizeNote"]>>,
): void {
  const knownIds = new Set(source.segments.map((segment) => segment.id));
  const referencedIds = [
    ...summary.actionItems.flatMap((item) => item.sourceSegmentIds),
    ...summary.decisions.flatMap((decision) => decision.sourceSegmentIds),
  ];

  if (referencedIds.some((id) => !knownIds.has(id))) {
    throw new ProviderError("Gemini referenced an unknown recording segment.");
  }
}
