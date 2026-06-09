# Plan 05: Final Integration, Composition, and Release Verification

## Objective

Integrate the four completed workstreams, resolve their shared contracts,
compose the responsive application, wire every job handler, verify the database
and provider boundaries, and leave the MVP runnable and documented.

Do not start this plan until plans `01` through `04` are complete.

## Inputs required from each agent

Collect:

- Changed-file list.
- Test commands and results.
- Any temporary feature-local types or adapters needing consolidation.
- Any additive migration or dependency request.
- Any unresolved imports or integration assumptions.

Do not silently discard one agent's implementation to resolve a conflict.
Prefer the fixed contracts in `README.md` and the simplest implementation that
preserves tested behavior.

## Integration steps

### 1. Reconcile shared contracts

- Consolidate duplicate enums, `ActionResult`, row types, mappers, and errors
  into the shared modules from plan `01`.
- Ensure all services use the same server admin client.
- Ensure all feature actions call `requireSession`.
- Keep repositories free of business transitions.
- Keep provider API calls out of actions, components, and repositories.
- Remove only duplicates made obsolete by integration; do not refactor unrelated
  code.

### 2. Reconcile dependencies and configuration

- Merge dependency additions into `package.json` and regenerate
  `package-lock.json` once.
- Keep Next.js configuration minimal.
- Create `.env.example` with names only, including
  `ASSEMBLYAI_WEBHOOK_SECRET`.
- Confirm no secret value or `.env` content is tracked.
- Run `npm audit`; document remaining findings instead of applying breaking
  forced upgrades automatically.

### 3. Database and job runtime

Review migrations as one ordered set:

- Enum values match TypeScript unions.
- Foreign keys and cascades match delete behavior.
- RLS is enabled with no anonymous data policies.
- Private buckets exist.
- Vector dimension is 768 and `match_chunks` filters by note when requested.
- Source replacement is transactional.
- Job deduplication and retry rules match `JobService`.
- Queue extensions/functions are created in supported schemas.

Wire the Edge Function dispatcher to:

- Claim a bounded batch.
- Dispatch every fixed job type to its service handler.
- Mark completion/failure through `JobService`.
- Avoid failing the entire batch for one job.
- Return a compact count summary.

Configure immediate invocation after enqueue and document the one-minute
`pg_cron`/`pg_net` recovery call. Do not hard-code project URLs or secrets in a
migration; document dashboard/SQL setup using Vault or environment-safe values.

Run local Supabase migration reset if Docker is available:

```bash
npx supabase start
npx supabase db reset
```

If local Supabase cannot run, execute migration lint/static validation and
report the limitation.

### 4. Compose the application

Own and implement:

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/(protected)/layout.tsx`
- `src/app/(protected)/dashboard/page.tsx`
- `src/app/(protected)/notes/[id]/page.tsx`
- `src/app/(protected)/search/page.tsx`

Behavior:

- `/` redirects based on session.
- Protected layout has compact navigation, logout, and mobile navigation.
- Dashboard lists notes and provides note creation.
- Note page loads one `NoteDetail` server-side and composes:
  recording, segments, active transcript editor, generated outputs,
  attachments, note chat, and job/status controls.
- Desktop uses a practical multi-column layout.
- Mobile uses accessible sections/tabs without hiding active recording state.
- Search page composes global semantic search only.
- All empty, loading, error, pending, stale-index, and failed-job states are
  visible and actionable.

Avoid adding features outside the MVP.

### 5. Cross-feature flow checks

Verify these complete flows:

1. Login -> create note -> edit metadata -> delete note.
2. Record -> signed upload -> confirm -> submit job -> AssemblyAI callback ->
   transcript -> audio deletion.
3. Transcript completion -> generation -> outputs -> note indexing.
4. Manual transcript edit -> revision increment -> stale indicator -> reindex.
5. Attachment upload -> extraction -> attachment indexing.
6. Global semantic search -> source-labelled results.
7. Note Q&A -> note-filtered retrieval -> validated citations -> chat history.
8. Failed job -> visible error -> retry -> legal state transition.

Confirm duplicate webhook delivery and duplicate job execution do not duplicate
outputs or chunks.

### 6. Testing

Run all unit tests and add missing integration tests at service boundaries.

Add Playwright tests using provider/Supabase mocks or controlled test fixtures:

- Login success/failure and route protection.
- Note CRUD.
- Mocked recording/upload/transcription status.
- Transcript edit and generation status.
- Attachment validation/upload/extraction status.
- Search results.
- Q&A citation rendering.
- Job retry.
- Mobile navigation and note sections.

Use stable accessible roles or explicit test IDs only where necessary.

Required checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Fix warnings that indicate correctness or accessibility problems. Do not perform
unrelated style refactors.

### 7. Real-provider smoke test

With configured credentials and a development Supabase project:

- Use a short non-sensitive audio sample.
- Confirm AssemblyAI callback authentication.
- Confirm transcript persistence precedes audio deletion.
- Generate outputs with Gemini.
- Confirm embeddings have 768 dimensions.
- Search for a phrase present in the transcript.
- Ask a note question and inspect citations.
- Upload one text, one small PDF, and one DOCX attachment.

Never commit smoke-test content, provider responses, or credentials.

### 8. Operational documentation

Create a concise root `README.md` covering:

- Prerequisites and environment variables.
- Supabase migration and bucket setup.
- Edge Function secrets and deployment.
- AssemblyAI webhook URL/auth setup.
- Queue recovery schedule setup.
- Local development commands.
- Test commands.
- Vercel deployment.
- Audio deletion policy and current MVP limitations.

Update `planning/credentials.md` only where it conflicts with the implemented
webhook-secret requirement.

## Final acceptance criteria

- All required checks pass, or an external-environment limitation is explicitly
  documented with the exact unrun check.
- No client bundle contains secret keys or server admin code.
- UI never performs direct database queries.
- All database writes flow through repositories and business transitions
  through services.
- Every provider, route, action, webhook, job payload, and AI output is
  validated.
- Audio deletion ordering, job idempotency, source-scoped indexing, and citation
  validation are covered by tests.
- The MVP is deployable with the documented environment and Supabase setup.

