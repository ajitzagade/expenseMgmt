"use client";

import { Copy, Link2, Pencil, RotateCcw, UserMinus, UserPlus, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Alert, Button, Input } from "@/components/ui";
import { useToast } from "@/components/toast";

export function AddParticipantForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/participants`, { method: "POST", json: { name: name.trim() } });
      toast(`${name.trim()} added to the trip`);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Input aria-label="Name" placeholder="e.g. Sneha" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={busy || !name.trim()}>
          <UserPlus className="size-4" aria-hidden />
          {busy ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}

export function InviteSection({ tripId }: { tripId: string }) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createLink() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const { joinPath } = await api<{ joinPath: string }>(`/api/trips/${tripId}/invitations`, { method: "POST", json: {} });
      setLink(`${window.location.origin}${joinPath}`);
      toast("Invite link created — valid for 7 days");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      {link ? (
        <>
          <p className="break-all rounded-lg bg-page px-3 py-2 font-mono text-xs text-ink">{link}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                toast("Invite link copied to clipboard");
              }}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="secondary" onClick={createLink} disabled={busy}>
              New link
            </Button>
          </div>
          <p className="text-xs text-ink-soft">For security, this link is only shown once — copy it now.</p>
        </>
      ) : (
        <Button onClick={createLink} disabled={busy}>
          <Link2 className="size-4" aria-hidden />
          {busy ? "Creating…" : "Create invite link"}
        </Button>
      )}
    </div>
  );
}

export function ParticipantActions({
  tripId,
  participantId,
  name,
  isGuest,
  inactive = false,
}: {
  tripId: string;
  participantId: string;
  name: string;
  isGuest: boolean;
  inactive?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"idle" | "rename" | "remove">("idle");
  const [newName, setNewName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (inactive) {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await api(`/api/trips/${tripId}/participants/${participantId}`, { method: "PATCH", json: { reactivate: true } });
            toast(`${name} is back on the trip`);
          })
        }
      >
        <RotateCcw className="size-4" aria-hidden />
        Bring back
      </Button>
    );
  }

  if (mode === "rename") {
    return (
      <span className="flex items-center gap-2">
        {error && <span className="text-xs text-negative">{error}</span>}
        <Input aria-label={`New name for ${name}`} className="h-8 w-32 text-sm" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} />
        <Button
          size="sm"
          disabled={busy || !newName.trim()}
          onClick={() =>
            run(async () => {
              await api(`/api/trips/${tripId}/participants/${participantId}`, { method: "PATCH", json: { name: newName.trim() } });
              toast(`${name} renamed to ${newName.trim()}`);
            })
          }
        >
          <Check className="size-4" aria-hidden />
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancel
        </Button>
      </span>
    );
  }

  if (mode === "remove") {
    return (
      <span className="flex items-center gap-2">
        {error && <span className="text-xs text-negative">{error}</span>}
        <span className="text-xs text-ink-soft">Remove {name}? Any expense history is kept.</span>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await api<{ removed: string }>(`/api/trips/${tripId}/participants/${participantId}`, { method: "DELETE" });
              toast(result.removed === "deactivated" ? `${name} removed — their expense history is kept` : `${name} removed`);
            })
          }
        >
          {busy ? "Removing…" : "Remove"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
          <X className="size-3.5" aria-hidden />
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {isGuest && (
        <Button size="sm" variant="ghost" onClick={() => setMode("rename")}>
          <Pencil className="size-3.5" aria-hidden />
          Rename
        </Button>
      )}
      <Button size="sm" variant="ghost" className="text-negative" onClick={() => setMode("remove")}>
        <UserMinus className="size-3.5" aria-hidden />
        Remove
      </Button>
    </span>
  );
}
