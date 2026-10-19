"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, setState] = useState<{ error?: string; sent?: boolean; busy?: boolean }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ busy: true });
    try {
      await api("/api/auth/forgot-password", { method: "POST", json: { email: form.get("email") } });
      setState({ sent: true });
    } catch (err) {
      setState({ error: err instanceof ApiError ? err.message : "Something went wrong" });
    }
  }

  if (state.sent) {
    return (
      <div className="mt-5">
        <Alert tone="success">If an account exists for that email, a reset link is on its way. It expires in 30 minutes.</Alert>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={state.busy}>
        {state.busy ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
