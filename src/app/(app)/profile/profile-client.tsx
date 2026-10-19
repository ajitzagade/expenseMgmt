"use client";

import { Check, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { SUPPORTED_CURRENCIES, CURRENCY_INFO } from "@/domain/money";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast";

export function ProfileForm({ initial }: { initial: { name: string; preferredCurrency: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ busy: true });
    try {
      await api("/api/me", {
        method: "PATCH",
        json: { name: form.get("name"), preferredCurrency: form.get("preferredCurrency") },
      });
      setState({});
      toast("Profile saved");
      router.refresh();
    } catch (err) {
      setState({ error: err instanceof ApiError ? err.message : "Something went wrong" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Name" htmlFor="profile-name">
        <Input id="profile-name" name="name" required maxLength={80} defaultValue={initial.name} />
      </Field>
      <Field label="Preferred currency" htmlFor="profile-currency">
        <Select id="profile-currency" name="preferredCurrency" defaultValue={initial.preferredCurrency}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} — {CURRENCY_INFO[c].name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={state.busy}>
        <Check className="size-4" aria-hidden />
        {state.busy ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const toast = useToast();
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== String(data.get("confirm") ?? "")) {
      setState({ error: "New passwords don't match" });
      return;
    }
    setState({ busy: true });
    try {
      await api("/api/me/password", {
        method: "POST",
        json: { currentPassword: data.get("currentPassword"), newPassword },
      });
      form.reset();
      setState({});
      toast("Password changed — other devices were signed out");
    } catch (err) {
      setState({ error: err instanceof ApiError ? err.message : "Something went wrong" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Current password" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="newPassword" hint="At least 8 characters.">
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
      </div>
      <Button type="submit" disabled={state.busy}>
        <KeyRound className="size-4" aria-hidden />
        {state.busy ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
