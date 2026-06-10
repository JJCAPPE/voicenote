import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const protectedPrefixes = ["/dashboard", "/notes", "/search"];

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] },
    );
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

function clearInvalidSession(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const authenticated = await hasValidSession(request);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) &&
    !authenticated
  ) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    return hasSessionCookie ? clearInvalidSession(response) : response;
  }

  const response = NextResponse.next();
  return pathname === "/login" && hasSessionCookie
    ? clearInvalidSession(response)
    : response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/notes/:path*", "/search/:path*", "/login"],
};
