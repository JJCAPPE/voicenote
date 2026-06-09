import { describe, expect, it } from "vitest";

import { chunkText, normalizeChunkText } from "@/server/services/chunker";

describe("chunkText", () => {
  it("normalizes line endings, repeated blanks, and blank input", () => {
    expect(normalizeChunkText("one\r\n\r\n\r\n\r\ntwo  \n")).toBe("one\n\ntwo");
    expect(chunkText(" \r\n \n ")).toEqual([]);
  });

  it("prefers paragraph boundaries with deterministic indexes", () => {
    const paragraphs = Array.from(
      { length: 18 },
      (_, index) => `Paragraph ${index}. ${"x".repeat(220)}`,
    );
    const text = paragraphs.join("\n\n");

    const first = chunkText(text);
    const second = chunkText(text);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first.map((chunk) => chunk.index)).toEqual(
      first.map((_, index) => index),
    );
    expect(first.every((chunk) => chunk.content.trim().length > 0)).toBe(true);
    expect(first[0]?.content.endsWith("x")).toBe(true);
  });

  it("carries overlap into the next chunk", () => {
    const text = Array.from(
      { length: 900 },
      (_, index) => `word-${String(index).padStart(4, "0")}`,
    ).join(" ");
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    const firstTail = chunks[0]?.content.slice(-200).trim();
    expect(chunks[1]?.content).toContain(firstTail!.split(" ").slice(-8).join(" "));
  });
});
