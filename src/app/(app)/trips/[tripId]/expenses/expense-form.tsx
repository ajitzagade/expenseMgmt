"use client";

import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { computeSplit, type SplitMethod } from "@/domain/split";
import { DomainError, parseAmountToMinor, CURRENCY_INFO, type CurrencyCode } from "@/domain/money";
import { minorToInput } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { Alert, Avatar, Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Money } from "@/components/money";

export interface ParticipantOption {
  id: string;
  name: string;
}

export interface ExpenseFormInitial {
  id: string;
  title: string;
  amountMinor: number;
  category: string;
  spentAt: string;
  notes: string | null;
  merchant: string | null;
  splitMethod: SplitMethod;
  payers: { participantId: string; amountMinor: number }[];
  allocations: { participantId: string; amountMinor: number; weight: number | null }[];
}

const SPLIT_OPTIONS: { value: SplitMethod; label: string; hint: string }[] = [
  { value: "EQUAL", label: "Equally", hint: "Everyone selected pays the same share." },
  { value: "EXACT", label: "Exact amounts", hint: "Type exactly what each person owes." },
  { value: "PERCENTAGE", label: "Percentages", hint: "Assign a percentage to each person (must total 100%)." },
  { value: "SHARES", label: "Shares", hint: "Weight by shares — e.g. a couple counts as 2." },
];

interface PerPerson {
  exact: string;
  percent: string;
  shares: string;
}

export function ExpenseForm({
  tripId,
  currency,
  participants,
  currentParticipantId,
  initial,
}: {
  tripId: string;
  currency: CurrencyCode;
  participants: ParticipantOption[];
  currentParticipantId: string;
  initial?: ExpenseFormInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const symbol = CURRENCY_INFO[currency].symbol;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial ? minorToInput(initial.amountMinor) : "");
  const [category, setCategory] = useState(initial?.category ?? "Food");
  const [customCategory, setCustomCategory] = useState(
    initial && !(CATEGORIES as readonly string[]).includes(initial.category) ? initial.category : "",
  );
  const [spentAt, setSpentAt] = useState(() => {
    const d = initial ? new Date(initial.spentAt) : new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [method, setMethod] = useState<SplitMethod>(initial?.splitMethod === "CUSTOM" ? "EXACT" : (initial?.splitMethod ?? "EQUAL"));

  // Payers. Single-payer is the common case; multi-payer shows amount inputs.
  const [multiPayer, setMultiPayer] = useState((initial?.payers.length ?? 1) > 1);
  const [singlePayerId, setSinglePayerId] = useState(initial?.payers[0]?.participantId ?? currentParticipantId);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.payers ?? []).map((p) => [p.participantId, minorToInput(p.amountMinor)])),
  );

  // Who shares the expense. New expenses preselect everyone (editable).
  const [selected, setSelected] = useState<Set<string>>(() =>
    initial ? new Set(initial.allocations.map((a) => a.participantId)) : new Set(participants.map((p) => p.id)),
  );
  const [perPerson, setPerPerson] = useState<Record<string, PerPerson>>(() => {
    const result: Record<string, PerPerson> = {};
    for (const p of participants) {
      const alloc = initial?.allocations.find((a) => a.participantId === p.id);
      result[p.id] = {
        exact: alloc && (initial?.splitMethod === "EXACT" || initial?.splitMethod === "CUSTOM") ? minorToInput(alloc.amountMinor) : "",
        percent: alloc && initial?.splitMethod === "PERCENTAGE" && alloc.weight != null ? String(alloc.weight / 100) : "",
        shares: alloc && initial?.splitMethod === "SHARES" && alloc.weight != null ? String(alloc.weight) : "1",
      };
    }
    return result;
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per form instance: a double-click or a retry after a lost
  // response replays the same creation instead of double-recording.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function setPerson(id: string, patch: Partial<PerPerson>) {
    setPerPerson((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  // ---- Live preview: same engine the server runs on save. ----
  const preview = useMemo(() => {
    let amountMinor: number;
    try {
      amountMinor = parseAmountToMinor(amount || "0", currency);
    } catch {
      return { error: amount ? "Enter a valid amount, e.g. 1250 or 1250.50" : null, allocations: null, amountMinor: 0 };
    }
    if (amountMinor <= 0) return { error: null, allocations: null, amountMinor: 0 };
    const chosen = participants.filter((p) => selected.has(p.id));
    if (chosen.length === 0) return { error: "Select at least one person to share this expense", allocations: null, amountMinor };
    try {
      const allocations = computeSplit({
        method,
        amountMinor,
        participants: chosen.map((p) => {
          const pp = perPerson[p.id];
          return {
            participantId: p.id,
            exactMinor: method === "EXACT" ? safeMinor(pp.exact, currency) : undefined,
            percentBps: method === "PERCENTAGE" ? safeBps(pp.percent) : undefined,
            shares: method === "SHARES" ? safeInt(pp.shares) : undefined,
          };
        }),
      });
      return { error: null, allocations, amountMinor };
    } catch (e) {
      return { error: e instanceof DomainError ? e.message : "Check the split values", allocations: null, amountMinor };
    }
  }, [amount, currency, method, participants, perPerson, selected]);

  const payerTotalMinor = useMemo(() => {
    if (!multiPayer) return preview.amountMinor;
    let total = 0;
    for (const id of Object.keys(payerAmounts)) {
      const v = safeMinor(payerAmounts[id], currency);
      if (v) total += v;
    }
    return total;
  }, [multiPayer, payerAmounts, preview.amountMinor, currency]);

  const payerMismatch = multiPayer && preview.amountMinor > 0 && payerTotalMinor !== preview.amountMinor;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!preview.allocations || preview.error) {
      setError(preview.error ?? "Complete the amount and split first");
      return;
    }
    const payers = multiPayer
      ? Object.entries(payerAmounts)
          .map(([participantId, v]) => ({ participantId, amountMinor: safeMinor(v, currency) ?? 0 }))
          .filter((p) => p.amountMinor > 0)
      : [{ participantId: singlePayerId, amountMinor: preview.amountMinor }];
    const finalCategory = category === "__custom__" ? customCategory.trim() : category;
    if (!finalCategory) {
      setError("Give the custom category a name");
      return;
    }
    setBusy(true);
    try {
      const body = {
        title,
        amountMinor: preview.amountMinor,
        category: finalCategory,
        spentAt: new Date(spentAt).toISOString(),
        notes: notes.trim() || undefined,
        merchant: merchant.trim() || undefined,
        payers,
        splitMethod: method,
        participants: participants
          .filter((p) => selected.has(p.id))
          .map((p) => {
            const pp = perPerson[p.id];
            return {
              participantId: p.id,
              ...(method === "EXACT" ? { exactMinor: safeMinor(pp.exact, currency) ?? 0 } : {}),
              ...(method === "PERCENTAGE" ? { percentBps: safeBps(pp.percent) ?? 0 } : {}),
              ...(method === "SHARES" ? { shares: safeInt(pp.shares) ?? 1 } : {}),
            };
          }),
      };
      if (initial) {
        await api(`/api/trips/${tripId}/expenses/${initial.id}`, { method: "PUT", json: body });
        toast(`Expense "${title}" updated`);
        router.push(`/trips/${tripId}/expenses/${initial.id}`);
      } else {
        await api(`/api/trips/${tripId}/expenses`, { method: "POST", json: { ...body, idempotencyKey } });
        toast(`Expense "${title}" added`);
        router.push(`/trips/${tripId}/expenses`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  const allocationByParticipant = new Map(preview.allocations?.map((a) => [a.participantId, a.amountMinor]));

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr]">
        <Field label={`Amount (${symbol})`} htmlFor="amount" error={preview.error && amount ? preview.error : undefined}>
          <Input
            id="amount"
            inputMode="decimal"
            autoFocus={!initial}
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 text-lg font-semibold tnum"
          />
        </Field>
        <Field label="Description" htmlFor="title">
          <Input
            id="title"
            required
            maxLength={120}
            placeholder="e.g. Beach shack dinner"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category">
          <>
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {customCategory && !(CATEGORIES as readonly string[]).includes(customCategory) && category !== "__custom__" && (
                <option value={customCategory}>{customCategory}</option>
              )}
              <option value="__custom__">Custom…</option>
            </Select>
            {category === "__custom__" && (
              <Input
                aria-label="Custom category name"
                className="mt-2"
                maxLength={30}
                placeholder="e.g. Scuba gear"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            )}
          </>
        </Field>
        <Field label="When" htmlFor="spentAt">
          <Input id="spentAt" type="datetime-local" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
        </Field>
      </div>

      {/* ---- Who paid ---- */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Who paid?</legend>
        {!multiPayer ? (
          <Select aria-label="Payer" value={singlePayerId} onChange={(e) => setSinglePayerId(e.target.value)}>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === currentParticipantId ? " (you)" : ""}
              </option>
            ))}
          </Select>
        ) : (
          <Card className="divide-y divide-line">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Avatar name={p.name} size="sm" /> {p.name}
                </span>
                <Input
                  aria-label={`Amount paid by ${p.name}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-28 text-right tnum"
                  value={payerAmounts[p.id] ?? ""}
                  onChange={(e) => setPayerAmounts({ ...payerAmounts, [p.id]: e.target.value })}
                />
              </div>
            ))}
            <p className={cx("px-3 py-2 text-xs", payerMismatch ? "text-negative" : "text-ink-soft")}>
              Paid so far: <Money minor={payerTotalMinor} currency={currency} />
              {preview.amountMinor > 0 && (
                <>
                  {" "}
                  of <Money minor={preview.amountMinor} currency={currency} />
                  {payerMismatch && " — contributions must add up to the total"}
                </>
              )}
            </p>
          </Card>
        )}
        <button
          type="button"
          className="text-sm font-medium text-primary hover:text-primary-hover"
          onClick={() => {
            if (!multiPayer) setPayerAmounts({ [singlePayerId]: amount });
            setMultiPayer(!multiPayer);
          }}
        >
          {multiPayer ? "← One person paid the whole bill" : "Split the payment between multiple people"}
        </button>
      </fieldset>

      {/* ---- Who shares it ---- */}
      <fieldset>
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium text-ink">Who shares this expense?</legend>
          <span className="flex gap-3 text-sm">
            <button type="button" className="font-medium text-primary" onClick={() => setSelected(new Set(participants.map((p) => p.id)))}>
              Select all
            </button>
            <button type="button" className="font-medium text-ink-soft" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Only tick the people who actually shared it — the payer doesn&apos;t have to be one of them.
        </p>

        <div className="mt-2 flex flex-wrap gap-1 rounded-lg bg-line/40 p-1" role="radiogroup" aria-label="Split method">
          {SPLIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={method === opt.value}
              onClick={() => setMethod(opt.value)}
              className={cx(
                "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                method === opt.value ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-soft">{SPLIT_OPTIONS.find((o) => o.value === method)?.hint}</p>

        <Card className="mt-3 divide-y divide-line">
          {participants.map((p) => {
            const checked = selected.has(p.id);
            const pp = perPerson[p.id];
            return (
              <div key={p.id} className={cx("flex items-center gap-3 px-3 py-2.5", !checked && "opacity-60")}>
                <input
                  id={`share-${p.id}`}
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    setSelected(next);
                  }}
                />
                <label htmlFor={`share-${p.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-ink">
                  <Avatar name={p.name} size="sm" />
                  <span className="truncate">
                    {p.name}
                    {p.id === currentParticipantId ? " (you)" : ""}
                  </span>
                </label>
                {checked && method === "EXACT" && (
                  <Input
                    aria-label={`Exact amount for ${p.name}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-24 text-right tnum"
                    value={pp.exact}
                    onChange={(e) => setPerson(p.id, { exact: e.target.value })}
                  />
                )}
                {checked && method === "PERCENTAGE" && (
                  <span className="flex items-center gap-1">
                    <Input
                      aria-label={`Percentage for ${p.name}`}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-16 text-right tnum"
                      value={pp.percent}
                      onChange={(e) => setPerson(p.id, { percent: e.target.value })}
                    />
                    <span className="text-sm text-ink-soft">%</span>
                  </span>
                )}
                {checked && method === "SHARES" && (
                  <Input
                    aria-label={`Shares for ${p.name}`}
                    inputMode="numeric"
                    className="w-16 text-right tnum"
                    value={pp.shares}
                    onChange={(e) => setPerson(p.id, { shares: e.target.value })}
                  />
                )}
                {checked && (
                  <span className="w-24 text-right text-sm">
                    {allocationByParticipant.has(p.id) ? (
                      <Money minor={allocationByParticipant.get(p.id)!} currency={currency} className="font-medium text-ink" />
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </Card>
        {preview.allocations && (
          <p className="mt-2 text-xs text-ink-soft">
            Split adds up to <Money minor={preview.amountMinor} currency={currency} /> exactly — nothing lost to rounding.
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Merchant or place (optional)" htmlFor="merchant">
          <Input id="merchant" maxLength={120} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Thalassa, Vagator" />
        </Field>
        <Field label="Notes (optional)" htmlFor="notes">
          <Textarea id="notes" maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={busy || !!preview.error || payerMismatch}>
          {initial ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          {busy ? "Saving…" : initial ? "Save changes" : "Add expense"}
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={() => router.back()}>
          <X className="size-4" aria-hidden />
          Cancel
        </Button>
      </div>
    </form>
  );
}

function safeMinor(value: string | undefined, currency: CurrencyCode): number | undefined {
  if (!value?.trim()) return undefined;
  try {
    return parseAmountToMinor(value, currency);
  } catch {
    return undefined;
  }
}

/** "33.33" -> 3333 bps without float drift. */
function safeBps(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return undefined;
  return parseInt(match[1], 10) * 100 + parseInt((match[2] ?? "").padEnd(2, "0") || "0", 10);
}

function safeInt(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
