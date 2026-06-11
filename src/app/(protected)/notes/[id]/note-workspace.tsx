"use client";

import Link from "next/link";
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
import type { AskQuestionResult, ChatSource } from "@/features/chat/chat.types";
import { ChatHistory } from "@/features/chat/components/chat-history";
import { ChatInput } from "@/features/chat/components/chat-input";
import { ChatSources } from "@/features/chat/components/chat-sources";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import {
  deleteNoteAction,
  saveLiveNotesAction,
  saveTranscriptAction,
  updateNoteAction,
} from "@/features/notes/actions/note.actions";
import { LiveNotesEditor } from "@/features/notes/components/live-notes-editor";
import { NoteForm } from "@/features/notes/components/note-form";
import {
  confirmSegmentUploadAction,
  createSegmentAction,
  retrySegmentAction,
} from "@/features/recordings/actions/recording.actions";
import {
  Recorder,
  type RecorderState,
} from "@/features/recordings/components/recorder";
import { SegmentList } from "@/features/recordings/components/segment-list";
import {
  hasOpenDialog,
  isTypingTarget,
} from "@/features/shortcuts/shortcuts";
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

type WorkspaceTab = "live" | "transcript" | "ai";
type ContextTab = "ask" | "sources" | "activity";

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
    generate_note: "Generate notes",
    index_note: "Index transcript",
    extract_attachment: "Extract attachment",
    index_attachment: "Index attachment",
  }[job.type];
}

function pipelineState(detail: NoteDetail) {
  const hasTranscript = activeTranscript(detail).trim().length > 0;
  const transcribed =
    detail.segments.length > 0 &&
    detail.segments.every((segment) => segment.status === "completed");
  const indexed =
    hasTranscript && detail.indexedRevision >= detail.transcriptRevision;
  const notesReady = detail.generatedOutputs.some(
    (output) => output.sourceRevision === detail.generationRevision,
  );
  return { transcribed, indexed, notesReady };
}

export function NoteWorkspace({
  initialDetail,
  autoStart = false,
  enableTranscriptionSync = false,
}: {
  initialDetail: NoteDetail;
  autoStart?: boolean;
  enableTranscriptionSync?: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [messages, setMessages] = useState(initialDetail.chatMessages);
  const [question, setQuestion] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("live");
  const [contextTab, setContextTab] = useState<ContextTab>("ask");
  const [askFocusRequest, setAskFocusRequest] = useState(0);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [mobilePane, setMobilePane] = useState<"details" | "note" | "context">(
    "note",
  );

  const attachments = useMemo(() => attachmentItems(detail), [detail]);
  const pipeline = pipelineState(detail);

  function replaceNote(note: Note) {
    setDetail((current) => ({ ...current, ...note }));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target) ||
        hasOpenDialog()
      ) {
        return;
      }
      if (event.key === "1") setWorkspaceTab("live");
      else if (event.key === "2") setWorkspaceTab("transcript");
      else if (event.key === "3") setWorkspaceTab("ai");
      else if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        setContextTab("ask");
        setMobilePane("context");
        setAskFocusRequest((current) => current + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const activeJobs = detail.jobs.filter(
      (job) => job.status === "queued" || job.status === "processing",
    );
    if (activeJobs.length === 0) return;

    const timer = window.setInterval(() => {
      void Promise.all(
        activeJobs.map(async (job) => {
          const response = await fetch(`/api/jobs/${job.id}`);
          return response.ok ? ((await response.json()) as Job) : job;
        }),
      ).then((updates) => {
        const completedRefresh = updates.some(
          (job) =>
            (job.type === "submit_transcription" ||
              job.type === "generate_note") &&
            job.status === "completed",
        );
        setDetail((current) => ({
          ...current,
          jobs: current.jobs.map(
            (job) => updates.find((update) => update.id === job.id) ?? job,
          ),
        }));
        if (completedRefresh) router.refresh();
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, [detail.jobs, router]);

  useEffect(() => {
    if (!enableTranscriptionSync) return;
    const transcribing = detail.segments.filter(
      (segment) => segment.status === "transcribing",
    );
    if (transcribing.length === 0) return;

    let cancelled = false;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        const updates = await Promise.all(
          transcribing.map(async (segment) => {
            const response = await fetch(
              `/api/recordings/${segment.id}/sync`,
              { method: "POST" },
            );
            return response.ok
              ? ((await response.json()) as {
                  status: "pending" | "completed" | "duplicate" | "failed";
                  segment: RecordingSegment;
                })
              : null;
          }),
        );
        if (cancelled) return;

        const changed = updates.filter(
          (update): update is NonNullable<typeof update> =>
            update !== null && update.status !== "pending",
        );
        if (changed.length === 0) return;
        setDetail((current) => ({
          ...current,
          segments: current.segments.map(
            (segment) =>
              changed.find((update) => update.segment.id === segment.id)
                ?.segment ?? segment,
          ),
        }));
        router.refresh();
      } finally {
        syncing = false;
      }
    };

    void sync();
    const timer = window.setInterval(() => void sync(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [detail.segments, enableTranscriptionSync, router]);

  async function saveTranscript(value: string) {
    const result = await saveTranscriptAction({ id: detail.id, transcript: value });
    if (!result.ok) throw new Error(result.error);
    replaceNote(result.data);
    setGenerationStatus("Transcript saved. Search indexing is queued.");
  }

  async function saveLiveNotes(value: string) {
    const result = await saveLiveNotesAction({ id: detail.id, liveNotes: value });
    if (!result.ok) throw new Error(result.error);
    replaceNote(result.data);
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
      sourceRevision: detail.generationRevision,
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
    setContextTab("activity");
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

  async function retryJob(jobId: string) {
    const response = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    if (!response.ok) return;
    const retried = (await response.json()) as Job;
    setDetail((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.id === retried.id ? retried : job)),
    }));
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
    <div className="note-workspace">
      <nav className="mobile-workspace-nav" aria-label="Workspace panes">
        <button
          type="button"
          aria-current={mobilePane === "details" ? "page" : undefined}
          onClick={() => setMobilePane("details")}
        >
          Details
        </button>
        <button
          type="button"
          aria-current={mobilePane === "note" ? "page" : undefined}
          onClick={() => setMobilePane("note")}
        >
          Note
        </button>
        <button
          type="button"
          aria-current={mobilePane === "context" ? "page" : undefined}
          onClick={() => setMobilePane("context")}
        >
          Ask & activity
        </button>
      </nav>
      <aside
        className="workspace-left-rail"
        data-mobile-active={mobilePane === "details"}
      >
        <Link className="back-link" href="/dashboard" prefetch={false}>
          ← Notes
        </Link>
        <div className="note-identity">
          <p className="utility-label">{detail.noteType.replace("_", " ")}</p>
          <h1>{detail.title}</h1>
          <p>{detail.description || "Description will be generated after transcription."}</p>
        </div>

        <details className="note-settings">
          <summary>Edit details</summary>
          <NoteForm note={detail} onSubmit={updateNoteAction} onSaved={replaceNote} />
        </details>

        <section className="rail-section">
          <div className="rail-heading">
            <h2>Segments</h2>
            <span>{detail.segments.length}</span>
          </div>
          <SegmentList segments={detail.segments} onRetry={retrySegment} />
        </section>

        <div className="rail-attachments">
          <AttachmentUploader
            noteId={detail.id}
            initialAttachments={attachments}
            enableShortcut
            actions={{
              createUpload: createAttachmentUploadAction,
              confirmUpload: confirmAttachmentUploadAction,
              deleteAttachment: deleteAttachmentAction,
              retryAttachment: retryAttachmentAction,
            }}
          />
        </div>

        <button className="danger-link" type="button" onClick={deleteNote}>
          Delete note
        </button>
      </aside>

      <main className="workspace-center" data-mobile-active={mobilePane === "note"}>
        <Recorder
          noteId={detail.id}
          autoStart={autoStart}
          createSegment={createSegmentAction}
          confirmSegment={confirmSegmentUploadAction}
          onStateChange={setRecorderState}
          onUploaded={(segment: RecordingSegment) => {
            setDetail((current) => ({
              ...current,
              segments: [...current.segments, segment],
            }));
            router.refresh();
          }}
        />

        <div className="workspace-toolbar">
          <div className="workspace-tabs" role="tablist" aria-label="Note workspace">
            {[
              ["live", "Live notes", "1"],
              ["transcript", "Transcript", "2"],
              ["ai", "AI notes", "3"],
            ].map(([value, label, key]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={workspaceTab === value}
                onClick={() => setWorkspaceTab(value as WorkspaceTab)}
              >
                {label} <kbd>{key}</kbd>
              </button>
            ))}
          </div>
          {workspaceTab === "ai" ? (
            <button
              className="generate-button"
              type="button"
              disabled={!activeTranscript(detail).trim()}
              onClick={() => void generate()}
            >
              Generate notes
            </button>
          ) : null}
        </div>

        <div className="workspace-document">
          {workspaceTab === "live" ? (
            <LiveNotesEditor
              key={detail.id}
              value={detail.liveNotes}
              onSave={saveLiveNotes}
            />
          ) : workspaceTab === "transcript" ? (
            activeTranscript(detail).trim() ? (
              <TranscriptEditor
                key={`${detail.activeTranscriptVersion}:${detail.transcriptRevision}`}
                value={activeTranscript(detail)}
                version={detail.activeTranscriptVersion}
                staleIndex={detail.indexedRevision < detail.transcriptRevision}
                onSave={saveTranscript}
              />
            ) : (
              <div className="document-empty-state">
                <h2>Your transcript will appear here.</h2>
                <p>Stop the recording to upload and begin transcription.</p>
              </div>
            )
          ) : (
            <GeneratedOutputs
              outputs={detail.generatedOutputs}
              currentRevision={detail.generationRevision}
            />
          )}
        </div>

        <footer className="workspace-status">
          <span>
            {recorderState === "recording" ? "Recording" : "Saved"} · Revision{" "}
            {detail.generationRevision}
          </span>
          {generationStatus ? <span aria-live="polite">{generationStatus}</span> : null}
        </footer>
      </main>

      <aside
        className="workspace-context-rail"
        data-mobile-active={mobilePane === "context"}
      >
        <div className="pipeline" aria-label="Note processing pipeline">
          <span data-complete={pipeline.transcribed}>Transcribed</span>
          <span data-complete={pipeline.indexed}>Indexed</span>
          <span data-complete={pipeline.notesReady}>Notes ready</span>
        </div>

        <div className="context-tabs" role="tablist" aria-label="Note context">
          {(["ask", "sources", "activity"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={contextTab === tab}
              onClick={() => setContextTab(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="context-content">
          {contextTab === "ask" ? (
            <section className="ask-panel">
              {detail.indexedRevision < detail.transcriptRevision ? (
                <p className="notice">
                  Search context is updating. Answers may use an older revision.
                </p>
              ) : null}
              <ChatHistory messages={messages as ChatMessage[]} />
              <ChatInput
                value={question}
                pending={chatPending}
                error={chatError}
                focusRequest={askFocusRequest}
                onChange={setQuestion}
                onSubmit={askQuestion}
              />
            </section>
          ) : contextTab === "sources" ? (
            sources.length > 0 ? (
              <ChatSources sources={sources} />
            ) : (
              <p className="context-empty">Sources from the latest answer appear here.</p>
            )
          ) : (
            <section className="activity-panel" aria-labelledby="activity-heading">
              <h2 className="sr-only" id="activity-heading">Activity</h2>
              {detail.jobs.length === 0 ? (
                <p className="context-empty">No background activity yet.</p>
              ) : (
                <ul className="activity-list">
                  {detail.jobs.map((job) => (
                    <li key={job.id}>
                      <div>
                        <strong>{jobLabel(job)}</strong>
                        <small>Attempt {job.attempts} of {job.maxAttempts}</small>
                      </div>
                      <JobStatusBadge status={job.status} />
                      {job.errorMessage ? <p role="alert">{job.errorMessage}</p> : null}
                      {job.status === "failed" && job.attempts < job.maxAttempts ? (
                        <button type="button" onClick={() => void retryJob(job.id)}>
                          Retry job
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
