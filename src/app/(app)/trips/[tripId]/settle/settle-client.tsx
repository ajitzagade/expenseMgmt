"use client";

import { Check, HandCoins, Plus, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { parseAmountToMinor, type CurrencyCode } from "@/domain/money";
import { minorToInput } from "@/lib/format";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import { Money } from "@/components/money";

interface Suggestion {
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
  fromName: string;
  toName: string;
}

export function RecordPaymentPanel({
  tripId,
  currency,
  suggestions,
  participants,
  canRecord,
}: {
  tripId: string;
  currency: CurrencyCode;
  suggestions: Suggestion[];
  participants: { id: string; name: string }[];
  canRecord: boolean;
}) {
  const [recording, setRecording] = useState<Suggestion | null>(null);
  const [custom, setCustom] = useState(false);

  return (
    <div className="mt-3 space-y-3">
      <Card className="divide-y divide-line">
        {suggestions.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm">
              <span className="font-medium text-ink">{s.fromName}</span>
              <span className="text-ink-soft"> pays </span>
              <span className="font-medium text-ink">{s.toName}</span>
            </span>
            <span className="flex items-center gap-3">
              <Money minor={s.amountMinor} currency={currency} className="font-semibold" />
              {canRecord && (
                <Button size="sm" variant="secondary" onClick={() => { setRecording(s); setCustom(false); }}>
                  <HandCoins className="size-4" aria-hidden />
                  Record payment
                </Button>
              )}
            </span>
          </div>
        ))}
      </Card>

      {canRecord && !recording && !custom && (
        <Button variant="ghost" size="sm" onClick={() => setCustom(true)}>
          <Plus className="size-4" aria-hidden />
          Record a payment not listed here
        </Button>
      )}

      {(recording || custom) && (
        <PaymentForm
          tripId={tripId}
          currency={currency}
          participants={participants}
          initial={recording}
          onClose={() => {
            setRecording(null);
            setCustom(false);
          }}
        />
      )}
    </div>
  );
}

function PaymentForm({
  tripId,
  currency,
  participants,
  initial,
  onClose,
}: {
  tripId: string;
  currency: CurrencyCode;
  participants: { id: string; name: string }[];
  initial: Suggestion | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [fromId, setFromId] = useState(initial?.fromParticipantId ?? participants[0]?.id ?? "");
  const [toId, setToId] = useState(initial?.toParticipantId ?? participants[1]?.id ?? "");
  const [amount, setAmount] = useState(initial ? minorToInput(initial.amountMinor) : "");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per form instance: double-clicking Save can never double-record.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function submit() {
    let amountMinor: number;
    try {
      amountMinor = parseAmountToMinor(amount, currency);
    } catch {
      setError("Enter a valid amount, e.g. 1200 or 1200.50");
      return;
    }
    if (fromId === toId) {
      setError("Payer and recipient must be different people");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/settlements`, {
        method: "POST",
        json: {
          fromParticipantId: fromId,
          toParticipantId: toId,
          amountMinor,
          method: method.trim() || undefined,
          note: note.trim() || undefined,
          idempotencyKey,
        },
      });
      const fromName = participants.find((p) => p.id === fromId)?.name ?? "Payment";
      const toName = participants.find((p) => p.id === toId)?.name ?? "";
      toast(`Payment recorded: ${fromName} paid ${toName}`);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <h3 className="font-medium text-ink">Record a payment</h3>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From" htmlFor="pay-from">
          <Select id="pay-from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To" htmlFor="pay-to">
          <Select id="pay-to" value={toId} onChange={(e) => setToId(e.target.value)}>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="pay-amount" hint={initial ? "Edit for a partial payment." : undefined}>
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tnum" />
        </Field>
        <Field label="Method (optional)" htmlFor="pay-method">
          <Input id="pay-method" placeholder="e.g. UPI, cash" maxLength={40} value={method} onChange={(e) => setMethod(e.target.value)} />
        </Field>
      </div>
      <Field label="Note (optional)" htmlFor="pay-note">
        <Input id="pay-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}>
          <Check className="size-4" aria-hidden />
          {busy ? "Recording…" : "Record payment"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          <X className="size-4" aria-hidden />
          Cancel
        </Button>
      </div>
    </Card>
  );
}

export function ReverseSettlementButton({ tripId, settlementId }: { tripId: string; settlementId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" aria-hidden />
        Reverse
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-negative">{error}</span>}
      <Input
        aria-label="Reason for reversal"
        className="h-8 w-44 text-sm"
        placeholder="Reason (required)"
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        size="sm"
        variant="danger"
        disabled={busy || !reason.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/trips/${tripId}/settlements/${settlementId}/reverse`, { method: "POST", json: { reason: reason.trim() } });
            toast("Payment reversed — balances updated");
            router.refresh();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
            setBusy(false);
          }
        }}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </span>
  );
}
