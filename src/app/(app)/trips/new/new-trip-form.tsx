"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { SUPPORTED_CURRENCIES, CURRENCY_INFO } from "@/domain/money";
import { TRIP_COLORS } from "@/lib/format";
import { Alert, Avatar, Badge, Button, Field, Input, Select, cx } from "@/components/ui";
import { useToast } from "@/components/toast";

export interface CompanionOption {
  key: string;
  name: string;
  userId: string | null;
}

export function NewTripForm({
  defaultCurrency,
  userName,
  companions,
}: {
  defaultCurrency: string;
  userName: string;
  companions: CompanionOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [names, setNames] = useState<string[]>(companions.length > 0 ? [""] : ["", "", ""]);
  const [selectedCompanions, setSelectedCompanions] = useState<Set<string>>(new Set());

  function toggleCompanion(key: string) {
    setSelectedCompanions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const chosen = companions.filter((c) => selectedCompanions.has(c.key));
    try {
      const { trip } = await api<{ trip: { id: string } }>("/api/trips", {
        method: "POST",
        json: {
          name: form.get("name"),
          destination: form.get("destination") || undefined,
          startDate: form.get("startDate") || undefined,
          endDate: form.get("endDate") || undefined,
          currency: form.get("currency"),
          colorIndex,
          companionUserIds: chosen.filter((c) => c.userId).map((c) => c.userId),
          participantNames: [
            ...chosen.filter((c) => !c.userId).map((c) => c.name),
            ...names.map((n) => n.trim()).filter(Boolean),
          ],
        },
      });
      toast("Trip created — add your first expense!");
      router.push(`/trips/${trip.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Trip name" htmlFor="name">
        <Input id="name" name="name" required maxLength={80} placeholder="e.g. Goa Weekend Trip" />
      </Field>
      <Field label="Destination (optional)" htmlFor="destination">
        <Input id="destination" name="destination" maxLength={120} placeholder="e.g. Goa" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" />
        </Field>
        <Field label="End date" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" />
        </Field>
      </div>
      <Field label="Currency" htmlFor="currency" hint="All expenses on this trip use one currency.">
        <Select id="currency" name="currency" defaultValue={defaultCurrency}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} — {CURRENCY_INFO[c].name}
            </option>
          ))}
        </Select>
      </Field>

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
                "size-8 rounded-full border-2 transition-transform",
                colorIndex === i ? "scale-110 border-ink" : "border-transparent hover:scale-105",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </fieldset>

      {companions.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-ink">People you&apos;ve travelled with</legend>
          <p className="mt-1 text-xs text-ink-soft">
            Tap to add them to this trip. Registered members get access right away; guests come along by name.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {companions.map((c) => {
              const selected = selectedCompanions.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCompanion(c.key)}
                  className={cx(
                    "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line bg-surface text-ink hover:border-primary/40",
                  )}
                >
                  <Avatar name={c.name} size="sm" />
                  {c.name}
                  {c.userId && (
                    <Badge tone={selected ? "primary" : "neutral"}>member</Badge>
                  )}
                  <span aria-hidden className={cx("text-xs", selected ? "text-primary" : "text-ink-soft")}>
                    {selected ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-ink">
          {companions.length > 0 ? "Add someone new (optional)" : "Travel mates (optional)"}
        </legend>
        <p className="mt-1 text-xs text-ink-soft">
          Add people by name — no accounts needed. You ({userName}) are included automatically. You can invite or add more
          later.
        </p>
        <div className="mt-2 space-y-2">
          {names.map((name, i) => (
            <Input
              key={i}
              aria-label={`Travel mate ${i + 1}`}
              value={name}
              maxLength={80}
              placeholder={["e.g. Rahul", "e.g. Amit", "e.g. Sneha"][i] ?? "Name"}
              onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
            />
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setNames([...names, ""])}>
          + Add another person
        </Button>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Plus className="size-4" aria-hidden />
        {busy ? "Creating…" : "Create trip"}
      </Button>
    </form>
  );
}
