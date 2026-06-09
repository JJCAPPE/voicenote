# Plan 04: Attachment Upload, Extraction, and Indexing Handoff

## Objective

Implement private attachment upload, validation, text/PDF/DOCX extraction,
status handling, retry behavior, and a clean handoff to the shared indexing
pipeline.

This plan runs concurrently with plans `01`, `02`, and `03`.

## File ownership

Own:

- `src/features/attachments/**`
- `src/server/repositories/attachment.repository.ts`
- `src/server/services/attachment.service.ts`
- `src/server/parsers/**`
- Focused tests for these modules.

May add:

- A narrowly scoped route handler under
  `src/app/api/attachments/**` only if direct upload confirmation cannot be
  expressed as a server action.

Do not edit:

- Shared note-page composition.
- Shared job, indexing, note, auth, or provider implementations.
- Existing migration unless an additive attachment-specific migration is
  unavoidable.

## Implementation

### 1. Accepted files and limits

Support:

- Plain text and common code/data files:
  `.txt`, `.md`, `.csv`, `.sql`, `.json`, `.yaml`, `.yml`, `.py`, `.ts`,
  `.tsx`, `.js`, `.jsx`, `.css`, `.html`
- PDF
- DOCX

Maximum size: 50 MB.

Validate using filename extension, declared MIME type, actual downloaded byte
size, and basic file signature for PDF/DOCX. Reject unsupported types before a
database row is created where possible.

### 2. Repository

Implement:

```ts
listForNote(noteId: string): Promise<Attachment[]>
findById(id: string): Promise<Attachment | null>
createPending(input): Promise<Attachment>
markProcessing(id: string): Promise<Attachment>
markCompleted(id: string, text: string, metadata: unknown): Promise<Attachment>
markFailed(id: string, message: string): Promise<Attachment>
delete(id: string): Promise<void>
```

Repository methods only read/write. Status-transition validation belongs in the
service.

### 3. Signed upload flow

Implement authenticated, Zod-validated actions:

```ts
createAttachmentUploadAction(input)
confirmAttachmentUploadAction(input)
deleteAttachmentAction(input)
retryAttachmentAction(input)
```

Flow:

1. Validate note ID, filename, MIME type, and claimed size.
2. Create an `uploaded` attachment row with path
   `notes/{noteId}/{attachmentId}/{sanitizedFilename}`.
3. Return a signed upload URL/token for private bucket `attachments`.
4. Browser uploads directly.
5. Confirmation verifies the Storage object exists and matches the maximum
   size.
6. Enqueue `extract_attachment` using the shared job contract.

If row creation succeeds but upload fails, allow deletion/retry from the UI.
Deleting an attachment removes both the storage object and database row; chunk
cascade/removal is handled by database relations or indexing integration.

### 4. Extraction

Create a parser registry selected by validated extension/type.

Parser interface:

```ts
interface AttachmentParser {
  parse(buffer: Buffer, input: ParserInput): Promise<{
    text: string;
    metadata: Record<string, unknown>;
  }>;
}
```

Implement:

- Plain text parser using UTF-8 decoding, rejecting binary/NUL-heavy input.
- PDF parser using `pdf-parse`, returning text plus page count.
- DOCX parser using `mammoth.extractRawText`, returning text plus warnings.

Normalize line endings and trim repeated blank lines. Reject an extraction that
produces no meaningful text.

Do not implement OCR, PPTX, image parsing, archive extraction, advanced SQL
parsing, or code AST parsing.

### 5. Attachment service

`extract(attachmentId)`:

- Allow only `uploaded` or retryable `failed` attachments.
- Mark `processing`.
- Download from private Storage using the server admin client.
- Revalidate actual size and signature.
- Parse according to the registry.
- Persist extracted text and metadata, then mark `completed`.
- Enqueue `index_attachment`.
- On any failure, mark `failed` with a safe user-facing message and retain the
  original file for retry.

Idempotency:

- If already completed with nonblank extracted text, do not parse again; ensure
  an `index_attachment` job exists.
- Retry must not create another attachment row or storage object.

Expose the extraction handler in a form the Edge job dispatcher can call.

### 6. Feature UI

Build data-driven components:

- Drag/drop and file-picker uploader.
- Upload progress and validation errors.
- Attachment list with filename, type, size, and explicit status.
- Retry and delete controls.
- “Searchable” indicator only after extraction is completed and indexing job is
  completed.

The component receives note ID and initial attachment data. It must use actions
or signed upload URLs and never instantiate a Supabase database client.

## Tests

Cover:

- Extension/MIME/size validation.
- Filename sanitization and stable storage paths.
- PDF and DOCX signature checks.
- UTF-8 parser and binary rejection.
- PDF extraction including page count.
- DOCX extraction including warnings.
- Empty extraction failure.
- Status transitions and retry idempotency.
- Download/parse failure retaining the Storage object.
- Successful extraction persisting text before indexing enqueue.
- Delete behavior for both Storage and database failure ordering.
- UI validation helper behavior for unsupported and oversized files.

Use small generated in-memory fixtures. Do not commit private documents or large
binary samples.

## Verification

Run:

```bash
npm test -- src/features/attachments src/server/parsers src/server/services/attachment.service.ts
npm run typecheck
```

## Done criteria

- Supported files upload only through signed private Storage URLs.
- Text, PDF, and DOCX extraction produces normalized text and metadata.
- Unsupported, binary, empty, and oversized files fail safely.
- Extraction retries are idempotent and preserve the original file on failure.
- Completed extraction enqueues exactly one source-scoped indexing job.
- Owned tests pass.

