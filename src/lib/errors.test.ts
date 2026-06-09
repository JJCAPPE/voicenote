import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  ProviderError,
  ValidationError,
  toActionResult,
} from "@/lib/errors";

describe("toActionResult", () => {
  it("maps typed errors to stable public results", () => {
    expect(toActionResult(new ValidationError())).toEqual({
      ok: false,
      error: "Invalid input.",
      code: "VALIDATION_ERROR",
    });
    expect(toActionResult(new AuthenticationError())).toEqual({
      ok: false,
      error: "Authentication required.",
      code: "AUTHENTICATION_ERROR",
    });
  });

  it("does not leak provider responses or unknown exception details", () => {
    const providerResult = toActionResult(
      new ProviderError("provider said: secret-token"),
    );
    const unknownResult = toActionResult(
      new Error("postgres password=secret-token"),
    );

    expect(JSON.stringify(providerResult)).not.toContain("secret-token");
    expect(JSON.stringify(unknownResult)).not.toContain("secret-token");
    expect(unknownResult).toEqual({
      ok: false,
      error: "Something went wrong.",
      code: "INTERNAL_ERROR",
    });
  });
});
