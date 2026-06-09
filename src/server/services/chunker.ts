export type TextChunk = {
  index: number;
  content: string;
  metadata: Record<string, unknown>;
};

export type ChunkTextOptions = {
  targetCharacters?: number;
  minimumCharacters?: number;
  maximumCharacters?: number;
  overlapCharacters?: number;
  metadata?: Record<string, unknown>;
};

export function normalizeChunkText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(
  value: string,
  options: ChunkTextOptions = {},
): TextChunk[] {
  const text = normalizeChunkText(value);
  if (!text) {
    return [];
  }

  const target = options.targetCharacters ?? 3_000;
  const minimum = options.minimumCharacters ?? 2_400;
  const maximum = options.maximumCharacters ?? 3_600;
  const overlap = options.overlapCharacters ?? 400;

  if (
    minimum <= 0 ||
    target < minimum ||
    maximum < target ||
    overlap < 0 ||
    overlap >= minimum
  ) {
    throw new RangeError("Invalid chunking boundaries.");
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const remaining = text.length - start;
    if (remaining <= maximum) {
      const content = text.slice(start).trim();
      if (content) {
        chunks.push({
          index: chunks.length,
          content,
          metadata: { ...options.metadata },
        });
      }
      break;
    }

    const minimumEnd = start + minimum;
    const maximumEnd = Math.min(start + maximum, text.length);
    const targetEnd = Math.min(start + target, maximumEnd);
    const end = chooseBoundary(text, minimumEnd, targetEnd, maximumEnd);
    const content = text.slice(start, end).trim();

    if (content) {
      chunks.push({
        index: chunks.length,
        content,
        metadata: { ...options.metadata },
      });
    }

    const nextStart = Math.max(start + 1, end - overlap);
    start = skipLeadingWhitespace(text, nextStart);
  }

  return chunks;
}

function chooseBoundary(
  text: string,
  minimumEnd: number,
  targetEnd: number,
  maximumEnd: number,
): number {
  const beforeTarget = text.lastIndexOf("\n\n", targetEnd);
  if (beforeTarget >= minimumEnd) {
    return beforeTarget;
  }

  const afterTarget = text.indexOf("\n\n", targetEnd);
  if (afterTarget >= 0 && afterTarget <= maximumEnd) {
    return afterTarget;
  }

  for (let index = maximumEnd; index >= minimumEnd; index -= 1) {
    if (/\s/.test(text[index] ?? "")) {
      return index;
    }
  }

  return maximumEnd;
}

function skipLeadingWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length && /\s/.test(text[index] ?? "")) {
    index += 1;
  }
  return index;
}
