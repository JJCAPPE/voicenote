export type ParserInput = {
  filename: string;
  mimeType: string;
  extension: string;
};

export type AttachmentParseResult = {
  text: string;
  metadata: Record<string, unknown>;
};

export interface AttachmentParser {
  parse(buffer: Buffer, input: ParserInput): Promise<AttachmentParseResult>;
}
