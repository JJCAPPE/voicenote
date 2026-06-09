import { afterEach, describe, expect, it, vi } from "vitest";

import { setValidServerEnv } from "@/test/env";
import { verifyPassword } from "@/lib/auth/password";

describe("verifyPassword", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the configured password", async () => {
    await setValidServerEnv();

    await expect(verifyPassword("correct-password")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    await setValidServerEnv();

    await expect(verifyPassword("wrong-password")).resolves.toBe(false);
  });
});
