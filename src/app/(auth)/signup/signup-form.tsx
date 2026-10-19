"use client";

import { UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { SUPPORTED_CURRENCIES, CURRENCY_INFO, type CurrencyCode } from "@/domain/money";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function SignupForm() {
  return (
    <Suspense>
      <SignupFormInner />
    </Suspense>
  );
}

function SignupFormInner() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        json: {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          preferredCurrency: form.get("currency"),
        },
      });
      router.push(next && next.startsWith("/") ? next : "/welcome");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Your name" htmlFor="name" hint="This is how trip mates will see you.">
        <Input id="name" name="name" autoComplete="name" required maxLength={80} placeholder="e.g. Ajit Kumar" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Preferred currency" htmlFor="currency">
        <Select id="currency" name="currency" defaultValue="INR">
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} — {CURRENCY_INFO[c as CurrencyCode].name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <UserPlus className="size-4" aria-hidden />
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
