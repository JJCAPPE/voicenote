import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { proxy } from "@/proxy";

const sessionSecret = "s".repeat(32);

async function validToken(): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(sessionSecret));
}

function request(path: string, token?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : undefined,
  });
}

describe("authentication middleware", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = sessionSecret;
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("clears an invalid cookie instead of redirecting login to dashboard", async () => {
    const response = await proxy(request("/login", "stale-token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE_NAME}=`,
    );
    expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
  });

  it("redirects an invalid protected request once and clears the cookie", async () => {
    const response = await proxy(request("/dashboard", "stale-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(response.headers.get("set-cookie")).toContain(
      `${SESSION_COOKIE_NAME}=`,
    );
  });

  it("redirects a valid login session to the dashboard", async () => {
    const response = await proxy(request("/login", await validToken()));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });
});
