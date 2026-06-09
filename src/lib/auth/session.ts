import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth/constants";
import { AuthenticationError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
export { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS };

export type Session = { authenticated: true };

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().SESSION_SECRET);
}

export async function signSessionToken(
  expiresInSeconds = SESSION_DURATION_SECONDS,
): Promise<string> {
  return new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getSecret());
}

export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  cookieStore.set(SESSION_COOKIE_NAME, await signSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    return payload.authenticated === true ? { authenticated: true } : null;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<void> {
  if (!(await getSession())) {
    throw new AuthenticationError();
  }
}
