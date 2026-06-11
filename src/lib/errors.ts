import type { ActionResult as ActionResultType } from "@/types/models";

export type ActionResult<T = undefined> = ActionResultType<T>;

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    internalMessage = publicMessage,
    options?: ErrorOptions,
  ) {
    super(internalMessage, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input.", options?: ErrorOptions) {
    super("VALIDATION_ERROR", "Invalid input.", message, options);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required.", options?: ErrorOptions) {
    super(
      "AUTHENTICATION_ERROR",
      "Authentication required.",
      message,
      options,
    );
  }
}

export class StorageError extends AppError {
  constructor(message = "Storage operation failed.", options?: ErrorOptions) {
    super("STORAGE_ERROR", "Storage operation failed.", message, options);
  }
}

export class ProviderError extends AppError {
  constructor(message = "Provider request failed.", options?: ErrorOptions) {
    super("PROVIDER_ERROR", "Provider request failed.", message, options);
  }
}

export class TranscriptionPendingError extends ProviderError {
  constructor() {
    super("Transcription is not complete.");
  }
}

export class JobStateError extends AppError {
  constructor(message = "Invalid job state.", options?: ErrorOptions) {
    super("JOB_STATE_ERROR", "Invalid job state.", message, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", options?: ErrorOptions) {
    super("NOT_FOUND", "Resource not found.", message, options);
  }
}

export function toPublicError(error: unknown): {
  error: string;
  code: string;
} {
  if (error instanceof AppError) {
    return { error: error.publicMessage, code: error.code };
  }

  return {
    error: "Something went wrong.",
    code: "INTERNAL_ERROR",
  };
}

export function toActionResult(error: unknown): ActionResult<never> {
  return { ok: false, ...toPublicError(error) };
}

export const toActionError = toActionResult;
