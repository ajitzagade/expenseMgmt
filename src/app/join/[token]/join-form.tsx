"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Alert, Button } from "@/components/ui";

export function JoinForm({
  token,
  claimableGuests,
  targetParticipant,
}: {
  token: string;
  claimableGuests: { id: string; name: string }[];
  targetParticipant: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>(targetParticipant?.id ?? "__new__");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { tripId } = await api<{ tripId: string }>("/api/invitations/accept", {
        method: "POST",
        json: { token, claimParticipantId: choice === "__new__" ? undefined : choice },
      });
      router.push(`/trips/${tripId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {claimableGuests.length > 0 && !targetParticipant && (
        <fieldset>
          <legend className="text-sm font-medium text-ink">Were you already added by name?</legend>
          <p className="mt-1 text-xs text-ink-soft">Claim your spot to keep the expenses already recorded for you.</p>
          <div className="mt-2 space-y-1.5">
            {claimableGuests.map((g) => (
              <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-soft/50">
                <input
                  type="radio"
                  name="claim"
                  className="accent-primary"
                  checked={choice === g.id}
                  onChange={() => setChoice(g.id)}
                />
                I&apos;m {g.name}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-soft/50">
              <input
                type="radio"
                name="claim"
                className="accent-primary"
                checked={choice === "__new__"}
                onChange={() => setChoice("__new__")}
              />
              I&apos;m not on this list — join as myself
            </label>
          </div>
        </fieldset>
      )}
      {targetParticipant && (
        <p className="text-sm text-ink">
          This invite links you to the “{targetParticipant.name}” spot and its recorded expenses.
        </p>
      )}
      <Button size="lg" className="w-full" onClick={join} disabled={busy}>
        {busy ? "Joining…" : "Join trip"}
      </Button>
    </div>
  );
}
