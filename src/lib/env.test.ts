import { afterEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "@/lib/errors";
import { getServerEnv, getServerEnvValue } from "@/lib/env";
import { setValidServerEnv } from "@/test/env";

describe("getServerEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses a valid environment lazily", async () => {
    await setValidServerEnv();

    expect(getServerEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://example.supabase.co",
    );
  });

  it("validates one value without requiring unrelated services", async () => {
    await setValidServerEnv();
    vi.stubEnv("GEMINI_API_KEY", "");

    expect(getServerEnvValue("SESSION_SECRET")).toBe("a".repeat(32));
  });

  it("rejects missing values with a safe validation error", async () => {
    await setValidServerEnv();
    vi.stubEnv("GEMINI_API_KEY", "");

    expect(() => getServerEnv()).toThrow(ValidationError);
    expect(() => getServerEnv()).toThrow("Server configuration is invalid.");
  });

  it("rejects malformed values", async () => {
    await setValidServerEnv();
    vi.stubEnv("SESSION_SECRET", "too-short");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");

    expect(() => getServerEnv()).toThrow(ValidationError);
  });
});
