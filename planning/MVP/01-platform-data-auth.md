# Plan 01: Platform, Data Contracts, and Authentication

## Objective

Provide the shared server foundation, database contract, typed errors,
Supabase clients, session authentication, and protected application shell used
by every other workstream.

This plan runs concurrently with plans `02` through `04`.

## File ownership

Own:

- `src/lib/auth/**`
- `src/lib/supabase/**`
- `src/lib/errors.ts`
- `src/lib/env.ts`
- `src/lib/utils.ts`
- `src/types/**`
- `src/features/auth/**`
- `src/app/login/**`
- `src/middleware.ts`
- Focused tests beside these modules.

May edit:

- `supabase/migrations/20260609000000_initial_schema.sql` only to fix a concrete
  schema defect discovered while implementing these contracts.

Do not edit:

- Protected dashboard, note, or search pages.
- Recording, transcription, AI, chat, search, or attachment feature folders.
- Supabase Edge Functions.
- Shared root layout or global CSS; the final agent owns composition.

## Implementation

### 1. Environment validation

Create a server-only Zod schema that validates:

- `APP_PASSWORD_HASH`
- `SESSION_SECRET` with a minimum length of 32
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ASSEMBLYAI_API_KEY`
- `ASSEMBLYAI_WEBHOOK_SECRET`
- `GEMINI_API_KEY`

Export `getServerEnv()`. Parse lazily so unit tests can import modules without a
fully populated environment.

### 2. Shared types and row models

Define application models and matching database row types for:

- `Note` and `NoteDetail`
- `RecordingSegment`
- `Attachment`
- `GeneratedOutput`
- `Chunk`
- `Job`
- `ChatMessage`

Use `Date` in application models and ISO strings in row models. Add mapper
functions for every row type. Keep enum unions aligned with the migration and
the contracts in `README.md`.

`NoteDetail` must contain arrays for segments, attachments, generated outputs,
and chat messages so feature agents have one stable page input.

### 3. Typed errors

Implement:

- `ValidationError`
- `AuthenticationError`
- `StorageError`
- `ProviderError`
- `JobStateError`
- `NotFoundError`

Each error has a stable `code` string and safe public message. Add a helper that
maps unknown exceptions to `ActionResult` without exposing provider responses,
SQL details, or stack traces.

### 4. Supabase clients

Implement a memoized server admin client using
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

Requirements:

- Never export the secret key.
- Throw typed errors for missing configuration.
- Provide a small helper that converts Supabase errors to typed application
  errors.
- Do not create a browser database client.

### 5. Password session

Use `bcryptjs` to compare the submitted password to `APP_PASSWORD_HASH`.

Use `jose` to sign an HS256 JWT containing:

```ts
{ authenticated: true }
```

Cookie requirements:

- Name: `voicenote_session`
- HTTP-only
- `sameSite: "lax"`
- `secure` in production
- Path `/`
- Seven-day expiration

Expose:

```ts
verifyPassword(password: string): Promise<boolean>
createSession(): Promise<void>
destroySession(): Promise<void>
getSession(): Promise<{ authenticated: true } | null>
requireSession(): Promise<void>
```

### 6. Auth actions and login UI

Implement Zod-validated `loginAction` and `logoutAction`.

- Successful login creates the cookie and redirects to `/dashboard`.
- Invalid credentials return a generic error.
- Logout clears the cookie and redirects to `/login`.

Build an accessible login form with pending and error states. Keep the component
dumb: it invokes the action and renders state.

### 7. Route protection

Use middleware only for a cheap cookie-presence redirect:

- Unauthenticated protected paths redirect to `/login`.
- An authenticated visit to `/login` redirects to `/dashboard`.

Every protected server action and protected page must still call
`requireSession`; cookie presence alone is not trusted.

## Tests

Add unit tests for:

- Every row mapper, including date conversion and nullable fields.
- Password success and failure.
- Session signing, verification, expiration, and invalid signatures.
- Error-to-`ActionResult` mapping without secret leakage.
- Environment validation with missing and malformed values.

Mock `next/headers` for cookie tests. Do not require Supabase to be running for
this plan's tests.

## Verification

Run:

```bash
npm test -- src/lib src/features/auth src/types
npm run typecheck
```

If full typecheck fails only because another concurrent workstream has not yet
landed, report the exact unresolved import and ensure owned-file tests pass.

## Done criteria

- Login produces a verifiable seven-day session cookie.
- Protected server code can call `requireSession`.
- Shared models and errors are usable without database details leaking upward.
- No secret or admin client is imported by a client component.
- All owned tests pass.

