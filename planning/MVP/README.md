# VoiceNote MVP Parallel Implementation

This folder splits the MVP into four concurrent implementation plans and one
final integration plan.

## Execution model

Run plans `01` through `04` concurrently. Run `05-final-integration.md` only
after all four workstreams are complete.

Each concurrent agent must:

1. Work only in the paths assigned by its plan.
2. Treat the database schema and contracts below as fixed.
3. Add focused unit tests for its own behavior.
4. Avoid editing shared composition files assigned to the final integrator.
5. Report changed files, commands run, failures, and any unresolved integration
   requirement.

The final agent owns cross-feature composition, dependency reconciliation,
full-project checks, local Supabase verification, and end-to-end testing.

## Existing baseline

The repository already contains:

- Next.js, TypeScript, Tailwind, ESLint, Vitest, and Playwright configuration.
- Required runtime dependencies in `package.json`.
- A Supabase config and initial migration at
  `supabase/migrations/20260609000000_initial_schema.sql`.
- Environment placeholders for app auth, Supabase, AssemblyAI, and Gemini.

Do not recreate the project or replace the existing migration wholesale.
Agents may add narrowly scoped follow-up migrations only when their plan assigns
migration ownership.

## Fixed architecture

```text
UI components
  -> server actions / route handlers
  -> services
  -> repositories
  -> Supabase
```

- Database access belongs in repositories.
- Business transitions belong in services.
- External APIs belong behind provider interfaces.
- Zod validates every server action, route, webhook, job payload, and structured
  AI response.
- Database rows use `snake_case`; application models use `camelCase`.
- All Supabase access is server-side. The browser may use only signed storage
  upload URLs.

## Fixed shared contracts

Agents must implement or consume these contracts without changing their names
or semantics. The final agent resolves imports if concurrent branches use
temporary feature-local declarations.

```ts
type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

type JobType =
  | "submit_transcription"
  | "generate_note"
  | "index_note"
  | "extract_attachment"
  | "index_attachment";

type JobStatus = "queued" | "processing" | "completed" | "failed";
type SegmentStatus =
  | "pending_upload"
  | "uploaded"
  | "transcribing"
  | "completed"
  | "failed";
type AttachmentStatus = "uploaded" | "processing" | "completed" | "failed";
type TranscriptVersion = "raw" | "cleaned" | "user_edited";
```

The shared server services must ultimately expose:

```ts
JobService.enqueue(input): Promise<Job>
JobService.retry(jobId): Promise<Job>
JobService.markCompleted(jobId, result?): Promise<void>
JobService.markFailed(jobId, error): Promise<void>

NoteService.get(noteId): Promise<NoteDetail>
NoteService.getActiveTranscript(noteId): Promise<string>
NoteService.saveEditedTranscript(noteId, transcript): Promise<Note>
```

Job payloads are fixed:

```ts
{ type: "submit_transcription"; segmentId: string }
{ type: "generate_note"; noteId: string; sourceRevision: number }
{ type: "index_note"; noteId: string; sourceRevision: number }
{ type: "extract_attachment"; attachmentId: string }
{ type: "index_attachment"; attachmentId: string }
```

## Shared UI integration contract

Feature agents build components, actions, and route handlers, but do not compose
the final note page. The final agent owns:

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/(protected)/layout.tsx`
- `src/app/(protected)/notes/[id]/page.tsx`
- `src/app/(protected)/dashboard/page.tsx`
- `src/app/(protected)/search/page.tsx`

Feature components should accept data and callbacks as props. They must not
query Supabase directly.

## Environment contract

Required:

```env
APP_PASSWORD_HASH=
SESSION_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_WEBHOOK_SECRET=
GEMINI_API_KEY=
```

The final agent updates `.env.example` and setup documentation. No agent reads,
prints, or commits values from `.env`.

## Merge order

The final agent should integrate in this order:

1. Platform, data, and authentication.
2. Notes, recording, transcription, and jobs.
3. AI generation, indexing, search, and chat.
4. Attachments.
5. Shared page composition, full tests, and operational setup.

