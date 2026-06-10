import { describe, expect, it, vi } from "vitest";
import {
  formatCombinedTranscript,
  selectActiveTranscript,
  type NoteRepository,
} from "@/server/repositories/note.repository";
import { NoteService } from "@/server/services/note.service";
import type { JobService } from "@/server/services/job.service";
import type { Note } from "@/types/models";

const note: Note = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Lecture",
  description: null,
  noteType: "lecture",
  liveNotes: "",
  rawCombinedTranscript: "raw",
  cleanedTranscript: "cleaned",
  userEditedTranscript: "edited",
  activeTranscriptVersion: "user_edited",
  transcriptRevision: 4,
  generationRevision: 4,
  indexedRevision: 3,
  titleOrigin: "user",
  descriptionOrigin: "placeholder",
  createdAt: new Date("2026-06-09T10:00:00Z"),
  updatedAt: new Date("2026-06-09T10:00:00Z"),
};

describe("note transcript behavior", () => {
  it("selects the configured active transcript", () => {
    expect(selectActiveTranscript(note)).toBe("edited");
    expect(
      selectActiveTranscript({
        ...note,
        activeTranscriptVersion: "cleaned",
      }),
    ).toBe("cleaned");
  });

  it("orders segments and adds visible headings", () => {
    expect(
      formatCombinedTranscript([
        { segmentIndex: 2, rawTranscript: "Second" },
        { segmentIndex: 1, rawTranscript: " First " },
        { segmentIndex: 3, rawTranscript: " " },
      ]),
    ).toBe("## Segment 1\n\nFirst\n\n## Segment 2\n\nSecond");
  });

  it("saves an edit and enqueues indexing for the new revision", async () => {
    const repository = {
      saveEditedTranscript: vi.fn(async () => ({
        ...note,
        transcriptRevision: 5,
        indexedRevision: 3,
      })),
    };
    const jobs = { enqueue: vi.fn(async () => undefined) };
    const service = new NoteService(
      repository as unknown as NoteRepository,
      jobs as unknown as JobService,
    );

    const saved = await service.saveEditedTranscript(note.id, " Revised ");

    expect(saved.transcriptRevision).toBe(5);
    expect(saved.indexedRevision).toBe(3);
    expect(repository.saveEditedTranscript).toHaveBeenCalledWith(
      note.id,
      "Revised",
    );
    expect(jobs.enqueue).toHaveBeenCalledWith({
      type: "index_note",
      noteId: note.id,
      sourceRevision: 5,
    });
  });

  it("rejects blank transcript edits", async () => {
    const service = new NoteService(
      {} as NoteRepository,
      {} as JobService,
    );
    await expect(service.saveEditedTranscript(note.id, "  ")).rejects.toThrow();
  });

  it("creates quick recording drafts with placeholder-owned metadata", async () => {
    const repository = {
      create: vi.fn(async () => note),
    };
    const service = new NoteService(
      repository as unknown as NoteRepository,
      {} as JobService,
    );

    await service.createQuickRecording();

    expect(repository.create).toHaveBeenCalledWith({
      title: "Untitled recording",
      description: null,
      noteType: "other",
      titleOrigin: "placeholder",
      descriptionOrigin: "placeholder",
    });
  });

  it("saves live notes without queueing transcript indexing", async () => {
    const repository = {
      saveLiveNotes: vi.fn(async () => ({
        ...note,
        liveNotes: "Remember the owner.",
        generationRevision: 5,
      })),
    };
    const jobs = { enqueue: vi.fn() };
    const service = new NoteService(
      repository as unknown as NoteRepository,
      jobs as unknown as JobService,
    );

    await expect(
      service.saveLiveNotes(note.id, "Remember the owner."),
    ).resolves.toMatchObject({ generationRevision: 5 });
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });
});
