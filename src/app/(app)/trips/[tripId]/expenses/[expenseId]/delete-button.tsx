"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Alert, Button } from "@/components/ui";
import { useToast } from "@/components/toast";

export function DeleteExpenseButton({ tripId, expenseId, title }: { tripId: string; expenseId: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <span className="text-sm text-ink">Delete “{title}”? Balances will be recalculated.</span>
      <Button
        variant="danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" });
            toast(`Expense "${title}" deleted`);
            router.push(`/trips/${tripId}/expenses`);
            router.refresh();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
            setBusy(false);
          }
        }}
      >
        {busy ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </div>
  );
}
