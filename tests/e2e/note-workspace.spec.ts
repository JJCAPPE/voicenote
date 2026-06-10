import { expect, test } from "@playwright/test";

import {
  admin,
  createFixtureNote,
  deleteFixtureNote,
  login,
} from "./helpers";

test("recording, transcript, generation, attachment, Q&A, and retry states", async ({
  page,
}) => {
  const note = await createFixtureNote({
    rawTranscript: "## Segment 1\n\nThe launch review is Friday at ten.",
    transcriptRevision: 1,
    indexedRevision: 0,
  });
  const segmentId = crypto.randomUUID();
  const attachmentId = crypto.randomUUID();
  const failedJobId = crypto.randomUUID();

  try {
    const { error: segmentError } = await admin.from("recording_segments").insert({
      id: segmentId,
      note_id: note.id,
      segment_index: 1,
      original_filename: "review.webm",
      storage_path: `notes/${note.id}/segments/${segmentId}.webm`,
      mime_type: "audio/webm",
      file_size_bytes: 100,
      duration_seconds: 8,
      status: "transcribing",
      external_provider: "assemblyai",
      external_job_id: `e2e-${segmentId}`,
    });
    if (segmentError) throw segmentError;

    const { error: attachmentError } = await admin.from("attachments").insert({
      id: attachmentId,
      note_id: note.id,
      filename: "agenda.txt",
      storage_path: `notes/${note.id}/${attachmentId}/agenda.txt`,
      mime_type: "text/plain",
      file_type: "text",
      file_size_bytes: 42,
      extracted_text: "Launch review agenda",
      extraction_status: "completed",
    });
    if (attachmentError) throw attachmentError;

    const { error: jobsError } = await admin.from("jobs").insert([
      {
        id: crypto.randomUUID(),
        job_type: "index_attachment",
        status: "completed",
        payload: { type: "index_attachment", attachmentId },
        deduplication_key: `e2e:index-attachment:${attachmentId}`,
        attempts: 1,
        completed_at: new Date().toISOString(),
      },
      {
        id: failedJobId,
        job_type: "generate_note",
        status: "failed",
        payload: {
          type: "generate_note",
          noteId: note.id,
          sourceRevision: 1,
        },
        deduplication_key: `e2e:failed-generation:${note.id}`,
        attempts: 1,
        error_message: "Provider unavailable.",
        completed_at: new Date().toISOString(),
      },
    ]);
    if (jobsError) throw jobsError;

    await login(page);
    await page.goto(`/notes/${note.id}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);

    await expect(page.getByText("Segment 1: transcribing")).toBeVisible();
    await expect(page.getByLabel("Searchable", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Search context is updating. Answers may use an older revision.",
      ),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Transcript 2" }).click();
    const transcript = page.getByLabel("Transcript");
    await transcript.fill(
      "The launch review is Friday at ten. The owner is Morgan.",
    );
    await page.getByRole("button", { name: "Save transcript" }).click();
    await expect(
      page.getByText("Transcript saved. Search indexing is queued."),
    ).toBeVisible();

    await page.getByRole("tab", { name: "AI notes 3" }).click();
    await page.getByRole("button", { name: "Generate notes" }).click();
    await expect(page.getByText("Generation queued.")).toBeVisible();

    await page.route(`**/api/jobs/${failedJobId}/retry`, async (route) => {
      const now = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: failedJobId,
          type: "generate_note",
          status: "queued",
          payload: {
            type: "generate_note",
            noteId: note.id,
            sourceRevision: 1,
          },
          deduplicationKey: `e2e:failed-generation:${note.id}`,
          result: null,
          errorMessage: null,
          attempts: 1,
          maxAttempts: 3,
          createdAt: now,
          startedAt: null,
          completedAt: null,
        }),
      });
    });
    await page.getByRole("tab", { name: "Activity" }).click();
    await page.getByRole("button", { name: "Retry job" }).click();
    await expect(page.locator(`[data-status="queued"]`).first()).toBeVisible();

    await page.route(`**/api/notes/${note.id}/ask`, async (route) => {
      const now = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            userMessage: {
              id: crypto.randomUUID(),
              noteId: note.id,
              role: "user",
              content: "When is the review?",
              citations: [],
              createdAt: now,
            },
            assistantMessage: {
              id: crypto.randomUUID(),
              noteId: note.id,
              role: "assistant",
              content: "The launch review is Friday at ten.",
              citations: [
                {
                  chunkId: crypto.randomUUID(),
                  quote: "Friday at ten",
                },
              ],
              createdAt: now,
            },
            insufficientContext: false,
            sources: [
              {
                chunkId: crypto.randomUUID(),
                quote: "Friday at ten",
                sourceLabel: "Transcript",
                excerpt: "The launch review is Friday at ten.",
              },
            ],
          },
        }),
      });
    });

    await page.getByRole("tab", { name: "Ask" }).click();
    await page
      .getByRole("textbox", { name: "Ask this note" })
      .fill("When is the review?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(
      page.getByText("The launch review is Friday at ten.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Sources" }).click();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();

    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      "accept",
      /\.pdf,\.docx/,
    );
  } finally {
    await deleteFixtureNote(note.id);
  }
});

test("global search and mobile note navigation use accessible controls", async ({
  page,
}) => {
  const note = await createFixtureNote();
  try {
    await login(page);
    await page.route("**/api/search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [
            {
              chunkId: crypto.randomUUID(),
              noteId: note.id,
              noteTitle: note.title,
              sourceType: "attachment",
              sourceId: crypto.randomUUID(),
              sourceLabel: "agenda.txt",
              excerpt: "The launch review is Friday.",
              metadata: { filename: "agenda.txt" },
              similarity: 0.91,
            },
          ],
        }),
      });
    });

    await page.goto("/search");
    await page.getByLabel("Search notes and attachments").fill("launch review");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("list", { name: "Search results" })).toContainText(
      "Attachment: agenda.txt",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/notes/${note.id}`);
    await expect(
      page.getByRole("navigation", { name: "Workspace panes" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible();
    await page.getByRole("button", { name: "Details" }).click();
    await expect(page.getByRole("heading", { name: note.title })).toBeVisible();
    await page.getByRole("button", { name: "Ask & activity" }).click();
    await expect(page.getByRole("tab", { name: "Ask" })).toBeVisible();
  } finally {
    await deleteFixtureNote(note.id);
  }
});
