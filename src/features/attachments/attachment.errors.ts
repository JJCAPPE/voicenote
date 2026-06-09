export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly publicMessage: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AttachmentValidationError extends AttachmentError {
  constructor(message: string, publicMessage = message) {
    super(message, "ATTACHMENT_VALIDATION", publicMessage);
  }
}

export class AttachmentParseError extends AttachmentError {
  constructor(message: string, publicMessage = "The file could not be read.") {
    super(message, "ATTACHMENT_PARSE", publicMessage);
  }
}

export class AttachmentStorageError extends AttachmentError {
  constructor(message: string, publicMessage = "The file is unavailable.") {
    super(message, "ATTACHMENT_STORAGE", publicMessage);
  }
}

export class AttachmentStateError extends AttachmentError {
  constructor(message: string, publicMessage = "The attachment cannot be processed in its current state.") {
    super(message, "ATTACHMENT_STATE", publicMessage);
  }
}

export class AttachmentNotFoundError extends AttachmentError {
  constructor() {
    super("Attachment not found", "ATTACHMENT_NOT_FOUND", "Attachment not found.");
  }
}

export function getAttachmentPublicError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof AttachmentError) {
    return { code: error.code, message: error.publicMessage };
  }

  return {
    code: "ATTACHMENT_ERROR",
    message: "The attachment request could not be completed.",
  };
}
