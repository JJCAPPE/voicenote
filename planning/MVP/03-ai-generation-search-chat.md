# Plan 03: AI Generation, Indexing, Search, and Note Q&A

## Objective

Implement Gemini provider adapters, versioned prompts, note generation,
idempotent transcript indexing, vector search, note-scoped Q&A with validated
citations, and chat history.

This plan runs concurrently with plans `01`, `02`, and `04`.

## File ownership

Own:

- `src/lib/ai/llm.provider.ts`
- `src/lib/ai/embedding.provider.ts`
- `src/lib/ai/gemini-llm.provider.ts`
- `src/lib/ai/gemini-embedding.provider.ts`
- `src/server/prompts/**`
- `src/server/repositories/generated-output.repository.ts`
- `src/server/repositories/chunk.repository.ts`
- `src/server/repositories/chat-message.repository.ts`
- `src/server/services/generation.service.ts`
- `src/server/services/indexing.service.ts`
- `src/server/services/search.service.ts`
- `src/server/services/chat.service.ts`
- `src/features/search/**`
- `src/features/chat/**`
- `src/features/transcription/components/generated-outputs.tsx`
- `src/app/api/search/route.ts`
- `src/app/api/notes/[id]/ask/route.ts`
- Focused tests for these modules.

Do not edit:

- Shared page composition.
- Note, recording, job, auth, or attachment-owned services.
- Supabase Edge Function dispatcher; expose callable job handlers for the final
  agent to register.

## Implementation

### 1. Provider interfaces

Define:

```ts
interface LLMProvider {
  cleanTranscript(input: CleanupInput): Promise<CleanupOutput>;
  summarizeNote(input: SummaryInput): Promise<SummaryOutput>;
  answerQuestion(input: QAInput): Promise<QAOutput>;
}

interface EmbeddingProvider {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
```

Gemini defaults:

- Generation model: `gemini-2.5-flash`.
- Embedding model: `gemini-embedding-001`.
- Embedding output dimension: 768.

Validate structured model output with Zod. Treat invalid JSON, invalid
citations, dimension mismatch, refusal, and empty output as `ProviderError`.

### 2. Versioned prompts

Create:

- `clean-transcript.v1.ts`
- `summarize-note.v1.ts`
- `answer-question.v1.ts`

Cleanup must preserve technical meaning, avoid summarizing, retain uncertainty,
and return:

```ts
{
  cleanedTranscript: string;
  topics: string[];
  possibleErrors: string[];
  technicalTerms: string[];
}
```

Summary must return:

```ts
{
  shortSummary: string;
  longSummary: string;
  markdownNotes: string;
  actionItems: Array<{
    task: string;
    owner: string | null;
    dueDate: string | null;
    sourceSegmentIds: string[];
  }>;
  decisions: Array<{
    decision: string;
    sourceSegmentIds: string[];
  }>;
  topics: string[];
}
```

Q&A must return:

```ts
{
  answer: string;
  insufficientContext: boolean;
  citations: Array<{ chunkId: string; quote: string }>;
}
```

Prompts must say not to invent facts and to return insufficient context when
evidence is absent.

### 3. Generated outputs

`GenerationService.generateNote(noteId, sourceRevision)`:

1. Load the note and completed segment metadata.
2. Stop without writing if the requested revision is stale.
3. Obtain the active transcript; fail clearly if empty.
4. Clean the transcript.
5. Summarize the cleaned result.
6. In one logical operation, update `cleaned_transcript` and upsert current
   generated outputs for summary, Markdown notes, action items, decisions, and
   topics.
7. Store model, exact prompt version, and source revision for every output.
8. Preserve a user-edited active transcript; otherwise set active version to
   `cleaned`.
9. Enqueue `index_note` for the same revision.

Retries overwrite the same note/output-type rows and do not create duplicates.

Expose a validated authenticated generation action and a presentational
generated-output panel. The action only enqueues; it does not wait for Gemini.

### 4. Chunking and indexing

Implement a deterministic, dependency-light chunker:

- Normalize line endings and trim repeated blank lines.
- Prefer paragraph boundaries.
- Target approximately 2,400-3,600 characters.
- Carry approximately 400 characters of overlap.
- Never emit blank chunks.
- Preserve source metadata and stable chunk indexes.

`IndexingService.indexNote(noteId, sourceRevision)`:

- Stop if revision is stale.
- Chunk only the active transcript for MVP.
- Generate document embeddings in batches.
- Verify every vector has exactly 768 finite numbers.
- Delete existing transcript chunks for this note and insert replacements.
- Update `indexed_revision` only after replacement succeeds.

The delete-and-recreate operation must be retry-safe. Prefer an RPC transaction;
if an additive migration is needed, add one owned migration rather than editing
the initial migration.

Expose `indexAttachment(attachmentId)` as a public service method for plan `04`:

- Require completed extraction and nonblank extracted text.
- Replace only chunks whose source type/id match that attachment.
- Preserve filename and section/page metadata.

### 5. Semantic search

Implement a Zod-validated route and server service:

```ts
search(query: string, options?: { noteId?: string; limit?: number })
```

- Query length: 2-500 characters.
- Default limit: 8; maximum: 20.
- Embed with the query task type.
- Call `match_chunks`.
- Return chunk ID, note ID/title, source type/id, excerpt, metadata, and
  similarity.
- Global search is allowed here; global Q&A is not.

Build a controlled search form and result list with source labels. Do not compose
the final search page.

### 6. Note-scoped Q&A

`ChatService.ask(noteId, question)`:

1. Validate question length 2-2,000.
2. Save the user message.
3. Retrieve up to eight chunks filtered to the selected note.
4. If no chunks exist, save and return an explicit insufficient-context answer.
5. Send only retrieved chunks and the question to Gemini.
6. Reject citation IDs not present in supplied context.
7. Save the assistant answer and structured citations.
8. Return both messages and source display data.

Never answer from model knowledge alone. A cited quote is a short excerpt and
must be found within its cited chunk after whitespace normalization.

Build controlled chat history/input/source components. Do not query Supabase in
client components.

## Tests

Cover:

- Prompt version constants and output schema validation.
- Gemini malformed JSON and 768-dimension enforcement.
- Cleanup and summary persistence with prompt/model metadata.
- Stale generation and stale indexing jobs becoming no-ops.
- Chunk boundaries, overlap, deterministic ordering, and blank input.
- Retry-safe replacement affecting only the requested source.
- Query/document embedding method selection.
- Search validation, filtering, and result mapping.
- Q&A with no context.
- Rejection of unknown citation IDs and quotes not found in source chunks.
- Successful chat persistence and source rendering data.

## Verification

Run:

```bash
npm test -- src/lib/ai src/server/prompts src/server/services src/features/search src/features/chat
npm run typecheck
```

## Done criteria

- Generation writes versioned structured outputs without duplicate rows.
- Transcript indexing is deterministic, source-scoped, and retry-safe.
- Global semantic search returns source-labelled results.
- Q&A cannot cite or answer outside the retrieved note context.
- Provider output is fully validated before persistence.
- Owned tests pass.

