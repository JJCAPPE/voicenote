import "server-only";

import { compare } from "bcryptjs";

import { getServerEnv } from "@/lib/env";

export async function verifyPassword(password: string): Promise<boolean> {
  return compare(password, getServerEnv().APP_PASSWORD_HASH);
}
