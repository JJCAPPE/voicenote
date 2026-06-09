"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  confirmAttachmentUploadAction,
  createAttachmentUploadAction,
  deleteAttachmentAction,
  retryAttachmentAction,
} from "@/features/attachments/attachment.actions";
import { AttachmentUploader } from "@/features/attachments/components/attachment-uploader";
import type { AttachmentListItem } from "@/features/attachments/attachment.types";
import { ChatHistory } from "@/features/chat/components/chat-history";
import { ChatInput } from "@/features/chat/components/chat-input";
import { ChatSources } from "@/features/chat/components/chat-sources";
import type { AskQuestionResult, ChatSource } from "@/features/chat/chat.types";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import {
  deleteNoteAction,
  saveTranscriptAction,
  updateNoteAction,
} from "@/features/notes/actions/note.actions";
import { NoteForm } from "@/features/notes/components/note-form";
import {
  confirmSegmentUploadAction,
  createSegmentAction,
  retrySegmentAction,
} from "@/features/recordings/actions/recording.actions";
import { Recorder } from "@/features/recordings/components/recorder";
import { SegmentList } from "@/features/recordings/components/segment-list";
import { generateNoteAction } from "@/features/transcription/actions/generate-note.action";
import { GeneratedOutputs } from "@/features/transcription/components/generated-outputs";
import { TranscriptEditor } from "@/features/transcription/components/transcript-editor";
import type {
  ChatMessage,
  Job,
  Note,
  NoteDetail,
  RecordingSegment,
} from "@/types/models";

function activeTranscript(note: Note): string {
  if (note.activeTranscriptVersion === "user_edited") {
    return note.userEditedTranscript ?? "";
  }
  if (note.activeTranscriptVersion === "cleaned") {
    return note.cleanedTranscript ?? "";
  }
  return note.rawCombinedTranscript ?? "";
}

function attachmentItems(detail: NoteDetail): AttachmentListItem[] {
  return detail.attachments.map((attachment) => {
    const job = detail.jobs.find(
      (candidate) =>
        candidate.payload.type === "index_attachment" &&
        candidate.payload.attachmentId === attachment.id,
    );
    return { ...attachment, indexingStatus: job?.status ?? null };
  });
}

function jobLabel(job: Job): string {
  return {
    submit_transcription: "Submit transcription",
    generate_note: "Generate note",
    index_note: "Index transcript",
    extract_attachment: "Extract attachment",
    index_attachment: "Index attachment",
  }[job.type];
}

function JobPanel({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const active = jobs.filter(
      (job) => job.status === "queued" || job.status === "processing",
    );
    if (active.length === 0) return;

    const timer = window.setInterval(() => {
      void Promise.all(
        active.map(async (job) => {
          const response = await fetch(`/api/jobs/${job.id}`);
          if (!response.ok) return job;
          return (await response.json()) as Job;
        }),
      ).then((updates) => {
        setJobs((current) =>
          current.map(
            (job) => updates.find((update) => update.id === job.id) ?? job,
          ),
        );
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [jobs]);

  async function retry(jobId: string) {
    setError(null);
    const response = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "The job could not be retried.");
      return;
    }
    const retried = (await response.json()) as Job;
    setJobs((current) =>
      current.map((job) => (job.id === retried.id ? retried : job)),
    );
  }

  return (
    <section className="panel" id="jobs" aria-labelledby="jobs-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Background work</p>
          <h2 id="jobs-heading">Jobs</h2>
        </div>
      </div>
      {jobs.length === 0 ? (
        <p>No background jobs yet.</p>
      ) : (
        <ul className="status-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <div>
                <strong>{jobLabel(job)}</strong>
                <small>
                  Attempt {job.attempts} of {job.maxAttempts}
                </small>
              </div>
              <JobStatusBadge status={job.status} />
              {job.errorMessage ? <p role="alert">{job.errorMessage}</p> : null}
              {job.status === "failed" && job.attempts < job.maxAttempts ? (
                <button type="button" onClick={() => void retry(job.id)}>
                  Retry job
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

export function NoteWorkspace({ initialDetail }: { initialDetail: NoteDetail }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [messages, setMessages] = useState(initialDetail.chatMessages);
  const [question, setQuestion] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  const attachments = useMemo(() => attachmentItems(detail), [detail]);

  function replaceNote(note: Note) {
    setDetail((current) => ({ ...current, ...note }));
  }

  async function saveTranscript(value: string) {
    const result = await saveTranscriptAction({ id: detail.id, transcript: value });
    if (!result.ok) throw new Error(result.error);
    replaceNote(result.data);
    setGenerationStatus("Transcript saved. Search indexing is queued.");
  }

  async function retrySegment(segmentId: string) {
    const result = await retrySegmentAction({ segmentId });
    if (!result.ok) throw new Error(result.error);
    setDetail((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id === result.data.id ? result.data : segment,
      ),
    }));
  }

  async function generate() {
    setGenerationStatus(null);
    const result = await generateNoteAction({
      noteId: detail.id,
      sourceRevision: detail.transcriptRevision,
    });
    if (!result.ok) {
      setGenerationStatus(result.error);
      return;
    }
    setDetail((current) => ({
      ...current,
      jobs: current.jobs.some((job) => job.id === result.data.job.id)
        ? current.jobs
        : [result.data.job, ...current.jobs],
    }));
    setGenerationStatus("Generation queued.");
  }

  async function askQuestion() {
    setChatPending(true);
    setChatError(null);
    try {
      const response = await fetch(`/api/notes/${detail.id}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await response.json()) as
        | { ok: true; data: AskQuestionResult }
        | { ok: false; error: string };
      if (!body.ok) throw new Error(body.error);
      setMessages((current) => [
        ...current,
        body.data.userMessage,
        body.data.assistantMessage,
      ]);
      setSources(body.data.sources);
      setQuestion("");
    } catch (askError) {
      setChatError(
        askError instanceof Error ? askError.message : "The question failed.",
      );
    } finally {
      setChatPending(false);
    }
  }

  async function deleteNote() {
    if (!window.confirm("Delete this note and all of its content?")) return;
    const result = await deleteNoteAction({ id: detail.id });
    if (!result.ok) {
      setGenerationStatus(result.error);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <>
      <header className="note-heading">
        <div>
          <p className="eyebrow">{detail.noteType.replace("_", " ")}</p>
          <h1>{detail.title}</h1>
          <p>{detail.description || "No description yet."}</p>
        </div>
        <button className="danger-button" type="button" onClick={deleteNote}>
          Delete note
        </button>
      </header>

      <nav className="section-nav" aria-label="Note sections">
        <a href="#recording">Recording</a>
        <a href="#transcript">Transcript</a>
        <a href="#generated">Generated</a>
        <a href="#attachments">Attachments</a>
        <a href="#chat">Q&amp;A</a>
        <a href="#jobs">Jobs</a>
      </nav>

      <div className="note-grid">
        <div className="note-main">
          <section className="panel recording-panel" id="recording">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Capture</p>
                <h2>Recording</h2>
              </div>
              <span className="status-dot">Live controls</span>
            </div>
            <Recorder
              noteId={detail.id}
              createSegment={createSegmentAction}
              confirmSegment={confirmSegmentUploadAction}
              onUploaded={(segment: RecordingSegment) => {
                setDetail((current) => ({
                  ...current,
                  segments: [...current.segments, segment],
                }));
                router.refresh();
              }}
            />
            <SegmentList segments={detail.segments} onRetry={retrySegment} />
          </section>

          <section className="panel" id="transcript">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Source of truth</p>
                <h2>Transcript</h2>
              </div>
              <button
                type="button"
                disabled={!activeTranscript(detail).trim()}
                onClick={() => void generate()}
              >
                Generate notes
              </button>
            </div>
            {!activeTranscript(detail).trim() ? (
              <p className="empty-state">
                A completed recording will appear here. You can edit the active
                transcript before generating notes.
              </p>
            ) : (
              <TranscriptEditor
                key={`${detail.activeTranscriptVersion}:${detail.transcriptRevision}`}
                value={activeTranscript(detail)}
                version={detail.activeTranscriptVersion}
                staleIndex={detail.indexedRevision < detail.transcriptRevision}
                onSave={saveTranscript}
              />
            )}
            {generationStatus ? (
              <p aria-live="polite">{generationStatus}</p>
            ) : null}
          </section>

          <section className="panel" id="generated">
            <GeneratedOutputs
              outputs={detail.generatedOutputs}
              currentRevision={detail.transcriptRevision}
            />
          </section>
        </div>

        <aside className="note-sidebar">
          <section className="panel" aria-labelledby="details-heading">
            <p className="eyebrow">Metadata</p>
            <h2 id="details-heading">Note details</h2>
            <NoteForm note={detail} onSubmit={updateNoteAction} onSaved={replaceNote} />
          </section>

          <div id="attachments">
            <AttachmentUploader
              noteId={detail.id}
              initialAttachments={attachments}
              actions={{
                createUpload: createAttachmentUploadAction,
                confirmUpload: confirmAttachmentUploadAction,
                deleteAttachment: deleteAttachmentAction,
                retryAttachment: retryAttachmentAction,
              }}
            />
          </div>

          <section className="panel" id="chat" aria-labelledby="chat-heading">
            <p className="eyebrow">Grounded retrieval</p>
            <h2 id="chat-heading">Ask this note</h2>
            {detail.indexedRevision < detail.transcriptRevision ? (
              <p className="notice">
                The transcript changed after the latest index. Answers may use
                older context until reindexing completes.
              </p>
            ) : null}
            <ChatHistory messages={messages as ChatMessage[]} />
            <ChatInput
              value={question}
              pending={chatPending}
              error={chatError}
              onChange={setQuestion}
              onSubmit={askQuestion}
            />
            <ChatSources sources={sources} />
          </section>

          <JobPanel initialJobs={detail.jobs} />
        </aside>
      </div>
    </>
  );
}
