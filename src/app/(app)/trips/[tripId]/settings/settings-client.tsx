"use client";

import { Archive, Check, Flag, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { TRIP_COLORS } from "@/lib/format";
import { Alert, Button, Field, Input, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { TripStatus } from "@/generated/prisma/enums";

export function TripSettingsForm({
  tripId,
  initial,
}: {
  tripId: string;
  initial: { name: string; destination: string; description: string; startDate: string; endDate: string; colorIndex: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [colorIndex, setColorIndex] = useState(initial.colorIndex);
  const [state, setState] = useState<{ error?: string; busy?: boolean }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ busy: true });
    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        json: {
          name: form.get("name"),
          destination: String(form.get("destination") ?? "").trim() || null,
          description: String(form.get("description") ?? "").trim() || null,
          startDate: String(form.get("startDate") ?? "") || null,
          endDate: String(form.get("endDate") ?? "") || null,
          colorIndex,
        },
      });
      setState({});
      toast("Trip details saved");
      router.refresh();
    } catch (err) {
      setState({ error: err instanceof ApiError ? err.message : "Something went wrong" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Trip name" htmlFor="name">
        <Input id="name" name="name" required maxLength={80} defaultValue={initial.name} />
      </Field>
      <Field label="Destination" htmlFor="destination">
        <Input id="destination" name="destination" maxLength={120} defaultValue={initial.destination} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" maxLength={2000} defaultValue={initial.description} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={initial.startDate} />
        </Field>
        <Field label="End date" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" defaultValue={initial.endDate} />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Trip color</legend>
        <div className="mt-2 flex gap-2">
          {TRIP_COLORS.map((color, i) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${i + 1}`}
              aria-pressed={colorIndex === i}
              onClick={() => setColorIndex(i)}
              className={cx(
                "size-8 rounded-full border-2",
                colorIndex === i ? "scale-110 border-ink" : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={state.busy}>
        <Check className="size-4" aria-hidden />
        {state.busy ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function TripStatusControls({ tripId, status }: { tripId: string; status: TripStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(next: TripStatus, message: string) {
    setBusy(next);
    setError(null);
    try {
      await api(`/api/trips/${tripId}`, { method: "PATCH", json: { status: next } });
      toast(message);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const actions: {
    label: string;
    to: TripStatus;
    variant: "primary" | "secondary" | "danger";
    show: boolean;
    icon: typeof Play;
    message: string;
  }[] = [
    { label: "Mark as ongoing", to: "ONGOING", variant: "secondary", show: status === "UPCOMING", icon: Play, message: "Trip marked as ongoing" },
    { label: "Complete trip", to: "COMPLETED", variant: "primary", show: status === "UPCOMING" || status === "ONGOING", icon: Flag, message: "Trip completed — check the final report" },
    { label: "Reopen trip", to: "ONGOING", variant: "primary", show: status === "COMPLETED" || status === "ARCHIVED", icon: RotateCcw, message: "Trip reopened" },
    { label: "Archive trip", to: "ARCHIVED", variant: "danger", show: status !== "ARCHIVED", icon: Archive, message: "Trip archived" },
  ];

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-ink">
        Current status: <span className="font-medium">{status.toLowerCase()}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Button key={a.label} variant={a.variant} size="sm" disabled={busy !== null} onClick={() => setStatus(a.to, a.message)}>
              <a.icon className="size-3.5" aria-hidden />
              {busy === a.to ? "Working…" : a.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
