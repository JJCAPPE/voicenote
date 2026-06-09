# Plan 02: Notes, Recording, Transcription, and Jobs

## Objective

Implement note CRUD, browser recording, signed audio upload, explicit job state
transitions, AssemblyAI submission/webhook handling, transcript persistence, and
audio deletion after successful persistence.

This plan runs concurrently with plans `01`, `03`, and `04`.

## File ownership

Own:

- `src/features/notes/**`
- `src/features/recordings/**`
- `src/features/transcription/**`
- `src/features/jobs/**`
- `src/server/repositories/note.repository.ts`
- `src/server/repositories/recording-segment.repository.ts`
- `src/server/repositories/job.repository.ts`
- `src/server/services/note.service.ts`
- `src/server/services/recording.service.ts`
- `src/server/services/transcription.service.ts`
- `src/server/services/job.service.ts`
- `src/lib/ai/transcription.provider.ts`
- `src/lib/ai/assemblyai-transcription.provider.ts`
- `src/app/api/webhooks/assemblyai/route.ts`
- `src/app/api/jobs/[id]/route.ts`
- `src/app/api/jobs/[id]/retry/route.ts`
- `supabase/functions/process-jobs/**`
- Focused tests for these modules.

Do not edit:

- Shared page composition listed in `README.md`.
- Auth, Gemini, search, chat, or attachment-owned files.
- The initial migration unless a separate additive migration is essential.

## Implementation

### 1. Note repository and service

Implement repository methods:

```ts
list(): Promise<Note[]>
findById(id: string): Promise<NoteDetail | null>
create(input: CreateNoteInput): Promise<Note>
update(id: string, input: UpdateNoteInput): Promise<Note>
delete(id: string): Promise<void>
getActiveTranscript(id: string): Promise<string>
saveEditedTranscript(id: string, transcript: string): Promise<Note>
rebuildRawCombinedTranscript(id: string): Promise<Note>
```

`rebuildRawCombinedTranscript` sorts completed segments by `segment_index`,
joins them with visible segment headings, increments `transcript_revision`, and
keeps the current active version unless it was `raw`.

`saveEditedTranscript`:

- Rejects blank input.
- Writes `user_edited_transcript`.
- Sets active version to `user_edited`.
- Increments `transcript_revision`.
- Leaves `indexed_revision` unchanged.
- Enqueues an idempotent `index_note` job keyed by note ID and new revision.

Add Zod schemas and authenticated server actions for list/create/update/delete
and transcript editing. Note titles are 1-200 characters.

### 2. Job state machine

Only `JobService` may transition jobs.

Implement:

```ts
enqueue(input): Promise<Job>
claimBatch(limit: number): Promise<Job[]>
markCompleted(jobId: string, result?: unknown): Promise<void>
markFailed(jobId: string, error: unknown): Promise<void>
retry(jobId: string): Promise<Job>
get(jobId: string): Promise<Job>
```

Rules:

- Enqueue uses the fixed payload schemas from `README.md`.
- Deduplication keys prevent duplicate active work for the same source/revision.
- Claim changes `queued` to `processing` and increments attempts.
- Complete is allowed only from `processing`.
- Fail is allowed only from `processing`.
- Retry is allowed only from `failed` while attempts are below `max_attempts`.
- Repeated completion of an already completed webhook-driven operation is a
  no-op, not an error.

After enqueue, call the `process-jobs` Edge Function without awaiting job
completion. Database queue/scheduled execution remains the recovery path.

### 3. Recording lifecycle

Create a client `Recorder` component that:

- Requests microphone permission only after a user gesture.
- Selects the first supported type from WebM/Opus, MP4, then browser default.
- Shows timer, recording state, playback preview, upload progress, and errors.
- Records one segment per start/stop cycle.
- Revokes object URLs on replacement/unmount.
- Prevents navigation loss only while recording or uploading.

Server flow:

1. `createSegmentAction` validates note ID, filename, MIME type, duration, and
   computes the next segment index transactionally.
2. It inserts a `pending_upload` row with path
   `notes/{noteId}/segments/{segmentId}.{extension}`.
3. It returns a signed upload token/URL for private bucket `audio-temp`.
4. Browser uploads directly to Storage.
5. `confirmSegmentUploadAction` verifies the object exists, marks `uploaded`,
   and enqueues `submit_transcription`.

Allow only audio MIME types and a maximum file size of 500 MB.

### 4. AssemblyAI adapter

Define a provider interface with:

```ts
submitAudio(input): Promise<{ externalJobId: string }>
getTranscript(externalJobId: string): Promise<RawTranscript>
```

The AssemblyAI implementation:

- Sends a short-lived signed Supabase audio URL.
- Uses `speech_models: ["universal-3-pro"]`.
- Enables language detection and speaker labels.
- Configures a webhook URL containing no secret data.
- Sends the webhook secret through AssemblyAI webhook auth headers.
- Validates all provider responses with Zod.
- Normalizes text, utterances, words, language, and duration.

### 5. Transcription worker and webhook

`submit_transcription` processing:

- Load and validate the segment.
- No-op if already completed.
- Require `uploaded` status.
- Create a signed audio URL.
- Submit to AssemblyAI.
- Persist provider/job ID and set `transcribing`.
- Complete the internal submit job.

Webhook route:

- Validate the shared secret header with constant-time comparison.
- Validate the body.
- Find the segment by external job ID.
- Return success for duplicate completed callbacks.
- Fetch the authoritative transcript from AssemblyAI rather than trusting the
  callback body.
- On provider failure, mark the segment failed while preserving audio.
- On success, save raw text, normalized provider JSON, and speaker labels in one
  database update.
- Rebuild the note's raw combined transcript.
- Only after both writes succeed, delete the Storage object and set
  `audio_deleted = true`.
- Enqueue `generate_note` for the new note revision.

If storage deletion fails, keep the transcript completed, keep
`audio_deleted = false`, and return/report a cleanup error without losing the
transcript.

### 6. Feature UI

Build data-driven components for final composition:

- Note create/edit form.
- Note list and delete control.
- Recorder.
- Ordered segment list with explicit status and retry button.
- Transcript editor receiving value, version, stale-index state, and save
  callback.
- Job status badge and polling hook.

Do not create the final dashboard or note page.

## Tests

Cover:

- Note row mapping and active transcript selection.
- Segment ordering and combined transcript formatting.
- Transcript edit revision/index invalidation.
- Every valid and invalid job transition.
- Deduplication behavior.
- MIME selection and recorder state helpers.
- Signed upload metadata validation.
- AssemblyAI request and response normalization.
- Invalid webhook secret and payload.
- Duplicate webhook delivery.
- Provider failure preserving audio.
- Persistence failure preventing audio deletion.
- Successful persistence followed by audio deletion and generation enqueue.

Use mocked repositories, fetch, and Storage. Real provider calls are not part of
automated tests.

## Verification

Run:

```bash
npm test -- src/features/notes src/features/recordings src/features/transcription src/features/jobs src/server/services
npm run typecheck
```

## Done criteria

- A note can be created, edited, listed, and deleted through server actions.
- A recording can be uploaded through a signed URL and reaches `transcribing`.
- An authenticated provider callback persists a transcript idempotently.
- Audio is never deleted before transcript persistence succeeds.
- Failed jobs can be retried only through `JobService`.
- Owned tests pass.

