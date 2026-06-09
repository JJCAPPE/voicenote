import { describe, expect, it, vi } from "vitest";

import type { LLMProvider } from "@/lib/ai/llm.provider";
import type { SaveGeneratedNoteInput } from "@/server/repositories/generated-output.repository";
import { GenerationService } from "@/server/services/generation.service";

const cleanup = {
  cleanedTranscript: "Clean transcript",
  topics: ["AI"],
  possibleErrors: [],
  technicalTerms: ["vector"],
};
const summary = {
  shortSummary: "Short",
  longSummary: "Long",
  markdownNotes: "# Notes",
  actionItems: [
    {
      task: "Ship",
      owner: null,
      dueDate: null,
      sourceSegmentIds: ["segment-1"],
    },
  ],
  decisions: [{ decision: "Use vectors", sourceSegmentIds: ["segment-1"] }],
  topics: ["AI"],
};

function llm(): LLMProvider {
  return {
    model: "gemini-2.5-flash",
    cleanTranscript: vi.fn(async () => cleanup),
    summarizeNote: vi.fn(async () => summary),
    answerQuestion: vi.fn(),
  };
}

describe("GenerationService", () => {
  it("does nothing for a stale revision", async () => {
    const outputs = { saveGeneratedNote: vi.fn() };
    const jobs = { enqueue: vi.fn() };
    const provider = llm();
    const service = new GenerationService(
      {
        getGenerationSource: vi.fn(async () => ({
          noteId: "note-1",
          sourceRevision: 2,
          activeTranscriptVersion: "raw" as const,
          transcript: "Raw",
          segments: [],
        })),
      },
      outputs,
      jobs,
      provider,
    );

    await expect(service.generateNote("note-1", 1)).resolves.toBe("stale");
    expect(provider.cleanTranscript).not.toHaveBeenCalled();
    expect(outputs.saveGeneratedNote).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("persists all outputs with model, prompt, and revision metadata", async () => {
    let write: SaveGeneratedNoteInput | undefined;
    const outputs = {
      saveGeneratedNote: vi.fn(async (input: SaveGeneratedNoteInput) => {
        write = input;
        return true;
      }),
    };
    const jobs = { enqueue: vi.fn(async () => undefined) };
    const service = new GenerationService(
      {
        getGenerationSource: vi.fn(async () => ({
          noteId: "note-1",
          sourceRevision: 3,
          activeTranscriptVersion: "user_edited" as const,
          transcript: "Raw",
          segments: [{ id: "segment-1", index: 0, label: "First" }],
        })),
      },
      outputs,
      jobs,
      llm(),
    );

    await expect(service.generateNote("note-1", 3)).resolves.toBe("generated");
    expect(write).toBeDefined();
    if (!write) {
      throw new Error("Expected generated output persistence.");
    }
    expect(write.preserveUserEditedTranscript).toBe(true);
    expect(write.outputs.map((output) => output.outputType)).toEqual([
      "summary",
      "markdown_notes",
      "action_items",
      "decisions",
      "topics",
    ]);
    expect(
      write.outputs.every(
        (output) =>
          output.model === "gemini-2.5-flash" &&
          output.promptVersion === "summarize-note.v1" &&
          output.sourceRevision === 3,
      ),
    ).toBe(true);
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "index_note",
      noteId: "note-1",
      sourceRevision: 3,
    });
  });

  it("does not enqueue indexing if the transactional write reports stale", async () => {
    const jobs = { enqueue: vi.fn() };
    const service = new GenerationService(
      {
        getGenerationSource: vi.fn(async () => ({
          noteId: "note-1",
          sourceRevision: 3,
          activeTranscriptVersion: "raw" as const,
          transcript: "Raw",
          segments: [{ id: "segment-1", index: 0, label: "First" }],
        })),
      },
      { saveGeneratedNote: vi.fn(async () => false) },
      jobs,
      llm(),
    );

    await expect(service.generateNote("note-1", 3)).resolves.toBe("stale");
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });
});
