# Credentials setup

The default MVP path from `initial-layout.md` is:

- Supabase for Postgres, Storage, and pgvector
- AssemblyAI for transcription
- Gemini for transcript cleanup, summaries, Q&A, and embeddings
- Vercel for deployment
- A locally managed password hash and session secret for the single-user gate

Gladia and OpenAI are optional fallback providers. Their variables can remain empty unless their adapters are enabled.

| Service | Environment variable | What to obtain | Where to get it | Scopes and notes |
| --- | --- | --- | --- | --- |
| App login | `APP_PASSWORD_HASH` | A bcrypt hash of the login password | Generate locally; for example, after installing `bcryptjs`, run `node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'your-password'` | Store only the hash, never the plaintext password. Server-only. Quote the value when setting it in a shell because bcrypt hashes contain `$`. |
| App session | `SESSION_SECRET` | At least 32 random bytes | Generate locally with `openssl rand -base64 32` | Used to sign or encrypt the session cookie. Server-only. Use a separate value for each environment. Rotating it logs out existing sessions. |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | [Supabase project API settings](https://supabase.com/dashboard/project/_/settings/api-keys) | This URL is public and may be used by browser code. |
| Supabase | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable API key | [Supabase project API keys](https://supabase.com/dashboard/project/_/settings/api-keys) | Intended for client-side use. Enable Row Level Security on exposed tables. Older projects may label the equivalent legacy key `anon`. |
| Supabase | `SUPABASE_SECRET_KEY` | Secret API key | [Supabase project API keys](https://supabase.com/dashboard/project/_/settings/api-keys) | Server-only and bypasses Row Level Security. Use it only for trusted API routes/workers, signed upload URLs, storage cleanup, and background jobs. Older projects may label the equivalent legacy key `service_role`. |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | Account API key | [AssemblyAI API keys](https://www.assemblyai.com/dashboard/api-keys) | Default transcription provider. Server-only. AssemblyAI account keys are not configured with app-level scopes. |
| Gemini | `GEMINI_API_KEY` | Gemini Developer API key attached to a Google Cloud project | [Google AI Studio API keys](https://aistudio.google.com/app/apikey) | Default generation and embedding provider. Server-only. Restrict the key to the Gemini API in Google Cloud when available; quotas and billing apply per project. |
| Gladia, optional | `GLADIA_API_KEY` | Account API key | [Gladia dashboard](https://app.gladia.io/) | Leave empty unless the Gladia transcription adapter is selected. Server-only; sent using the `x-gladia-key` header. |
| OpenAI, optional | `OPENAI_API_KEY` | Project API key | [OpenAI API keys](https://platform.openai.com/api-keys) | Leave empty unless the OpenAI fallback adapter is selected. Server-only. Prefer a project key with restricted permissions for only the endpoints the adapter uses. |
| Vercel | No local credential required | A Vercel account and linked project | [Vercel dashboard](https://vercel.com/dashboard) | Add the same environment variables in Project Settings > Environment Variables. Set secrets separately for Development, Preview, and Production as needed. Git-based deployment does not require a Vercel token in this app. |

## Supabase setup notes

Create private `audio-temp`, `attachments`, and `exports` Storage buckets. Enable `vector` in the database and apply Row Level Security to every browser-accessible table. Never expose `SUPABASE_SECRET_KEY` through a `NEXT_PUBLIC_` variable.

## Provider selection

Only the selected providers must be populated:

| Capability | Default | Optional fallback |
| --- | --- | --- |
| Transcription | `ASSEMBLYAI_API_KEY` | `GLADIA_API_KEY` or `OPENAI_API_KEY` |
| Summaries, cleanup, and Q&A | `GEMINI_API_KEY` | `OPENAI_API_KEY` |
| Embeddings | `GEMINI_API_KEY` | `OPENAI_API_KEY` |

No webhook secret is required if the worker polls the transcription provider for status. If callbacks are added later, create a separate random callback secret and verify it on every webhook request.
