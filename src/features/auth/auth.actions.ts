"use server";

import { redirect } from "next/navigation";

import { loginSchema, logoutSchema } from "@/features/auth/auth.schemas";
import {
  createSession,
  destroySession,
  verifyPassword,
} from "@/lib/auth";
import {
  AuthenticationError,
  ValidationError,
  toActionResult,
} from "@/lib/errors";
import type { ActionResult } from "@/types/models";

export type LoginActionState = ActionResult;

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  try {
    const parsed = loginSchema.safeParse({
      password: formData.get("password"),
    });

    if (!parsed.success) {
      throw new ValidationError();
    }

    if (!(await verifyPassword(parsed.data.password))) {
      throw new AuthenticationError("Invalid credentials.");
    }

    await createSession();
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof AuthenticationError
    ) {
      return {
        ok: false,
        code: "INVALID_CREDENTIALS",
        error: "Invalid credentials.",
      };
    }

    return toActionResult(error);
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<never> {
  logoutSchema.parse({});
  await destroySession();
  redirect("/login");
}
