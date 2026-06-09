# VoiceNote

VoiceNote is a private, single-user MVP for segmented audio recording,
AssemblyAI transcription, Gemini-generated notes, attachment extraction,
semantic search, and note-scoped Q&A.

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project
- Supabase CLI
- Docker only when running the full Supabase stack locally
- AssemblyAI and Gemini API credentials

Copy the variable names from `.env.example` into `.env`. Use the Supabase
project API URL for `NEXT_PUBLIC_SUPABASE_URL`, not the database connection
string. Generate independent random values of at least 32 characters for
`SESSION_SECRET` and `JOB_WORKER_SECRET`.

Next.js expands dollar-prefixed tokens in `.env`. Escape every `$` in the local
bcrypt value as `\$` (for example, `APP_PASSWORD_HASH=\$2b\$...`). Secret
managers such as Vercel can store the raw hash value.

`APP_URL` must be the public application origin. AssemblyAI calls
`${APP_URL}/api/webhooks/assemblyai`.

## Supabase

Link and apply the ordered migrations:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

The migrations create the private `audio-temp` and `attachments` buckets,
enable RLS without anonymous policies, install vector/cron/network extensions,
and grant Data API access only to `service_role`.

Deploy the worker and set its application-facing secrets:

```bash
npx supabase secrets set APP_URL=https://your-app.example
npx supabase secrets set JOB_WORKER_SECRET=<same-value-as-the-app>
npx supabase functions deploy process-jobs
```

Configure AssemblyAI to use the webhook URL above and send
`ASSEMBLYAI_WEBHOOK_SECRET` as its webhook authorization header.

### Queue recovery

Immediate processing is requested after every enqueue. Configure a one-minute
recovery call with Vault, `pg_cron`, and `pg_net`:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<supabase-secret-key>', 'worker_api_key');

select cron.schedule(
  'process-voicenote-jobs',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/process-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'worker_api_key'
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'worker_api_key'
      )
    ),
    body := '{"limit":5}'::jsonb
  );
  $$
);
```

Do not place project URLs or keys in migrations.

## Development

```bash
npm install
npm run dev
```

Required checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright uses controlled remote Supabase fixtures and mocked provider
responses. It requires configured Supabase server credentials. Provider smoke
tests are manual and must use non-sensitive sample files.

## Provider smoke test

With the app and worker deployed:

1. Record a short non-sensitive clip and confirm the authenticated AssemblyAI
   callback persists the transcript before `audio-temp` is deleted.
2. Generate notes and confirm each embedding has 768 dimensions.
3. Search for a phrase from the transcript and ask a note question with a
   source citation.
4. Upload one text file, one small PDF, and one DOCX file.

Do not commit provider responses, uploaded samples, or credentials.

## Deployment

Deploy the Next.js app to Vercel and configure every variable from
`.env.example` in the project environment. Set `APP_URL` to the final Vercel
origin, redeploy the worker secret, and update the AssemblyAI webhook URL.

Audio remains private and temporary. It is deleted only after transcript
persistence and combined-transcript rebuilding succeed. Cleanup failures retain
the transcript and expose an actionable error. Deleting a note removes its
remaining private objects before deleting database rows.

Current MVP limitations: one shared password, no OCR or image/PPTX extraction,
no global Q&A, and asynchronous provider work that depends on the Edge Function
and cron recovery path.
