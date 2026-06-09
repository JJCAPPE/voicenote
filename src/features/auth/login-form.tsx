"use client";

import { useActionState } from "react";

import {
  loginAction,
  type LoginActionState,
} from "@/features/auth/auth.actions";

const initialState: LoginActionState = {
  ok: true,
  data: undefined,
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="password">Password</label>
        <input
          autoComplete="current-password"
          disabled={pending}
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {!state.ok ? (
        <p aria-live="polite" role="alert">
          {state.error}
        </p>
      ) : null}

      <button disabled={pending} type="submit">
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
