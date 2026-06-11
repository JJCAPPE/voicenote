import "server-only";

import { compare } from "bcryptjs";

import { getServerEnvValue } from "@/lib/env";

export async function verifyPassword(password: string): Promise<boolean> {
  return compare(password, getServerEnvValue("APP_PASSWORD_HASH"));
}
