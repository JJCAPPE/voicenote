import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setValidServerEnv } from "@/test/env";

const cookieValues = new Map<string, string>();
const cookieSet = vi.fn(
  (
    name: string,
    value: string,
    options?: {
      expires?: Date;
      httpOnly?: boolean;
      path?: string;
      sameSite?: string;
      secure?: boolean;
    },
  ) => {
    if (value) {
      cookieValues.set(name, value);
    } else {
      cookieValues.delete(name);
    }
    return options;
  },
);

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
    set: cookieSet,
  })),
}));

import {
  SESSION_COOKIE_NAME,
  createSession,
  destroySession,
  getSession,
  signSessionToken,
} from "@/lib/auth/session";

describe("password session", () => {
  beforeEach(async () => {
    cookieValues.clear();
    cookieSet.mockClear();
    await setValidServerEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and verifies a seven-day secure cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await createSession();

    expect(await getSession()).toEqual({ authenticated: true });
    expect(cookieSet).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
      }),
    );

    const options = cookieSet.mock.calls[0]?.[2];
    const duration = options?.expires
      ? options.expires.getTime() - Date.now()
      : 0;
    expect(duration).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(duration).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it("rejects expired sessions", async () => {
    const token = await signSessionToken(-1);
    cookieValues.set(SESSION_COOKIE_NAME, token);

    await expect(getSession()).resolves.toBeNull();
  });

  it("rejects invalid signatures", async () => {
    await createSession();
    vi.stubEnv("SESSION_SECRET", "b".repeat(32));

    await expect(getSession()).resolves.toBeNull();
  });

  it("destroys the session cookie", async () => {
    await createSession();
    await destroySession();

    expect(cookieValues.has(SESSION_COOKIE_NAME)).toBe(false);
    expect(cookieSet).toHaveBeenLastCalledWith(
      SESSION_COOKIE_NAME,
      "",
      expect.objectContaining({ expires: new Date(0) }),
    );
  });
});
