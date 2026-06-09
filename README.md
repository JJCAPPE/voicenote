# VoiceNote

A private note-taking app that turns voice recordings into searchable, AI-enriched notes.

Record audio in segments, transcribe with AssemblyAI, generate summaries and embeddings with Gemini, attach files, and search or chat within a note.

## Stack

- **Next.js** — app and API routes
- **Supabase** — Postgres, storage, auth, Edge Functions
- **AssemblyAI** — transcription
- **Gemini** — note generation, embeddings, Q&A

## Getting started

**Prerequisites:** Node.js 20+, a Supabase project, and API keys for AssemblyAI and Gemini.

```bash
npm install
cp .env.example .env   # fill in values
npm run dev
```

Apply database migrations with the Supabase CLI (`supabase link` + `supabase db push`), then deploy the `process-jobs` Edge Function. See `planning/` for full setup, credentials, and deployment details.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |

## MVP scope

Single-user, password-protected. Supports segmented recording, transcription, AI notes, semantic search, note-scoped Q&A, and text/PDF/DOCX attachments. Audio is temporary and deleted after transcription succeeds.
