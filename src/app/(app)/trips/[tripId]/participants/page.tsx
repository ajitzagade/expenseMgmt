import type { Metadata } from "next";
import Link from "next/link";
import { requireTripPage } from "@/lib/guards";
import { getTripFinancials } from "@/server/services/balance-service";
import { Avatar, Badge, Card } from "@/components/ui";
import { Money } from "@/components/money";
import type { CurrencyCode } from "@/domain/money";
import { AddParticipantForm, InviteSection, ParticipantActions } from "./participants-client";

export const metadata: Metadata = { title: "People" };

export default async function ParticipantsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { access } = await requireTripPage(tripId);
  const currency = access.trip.currency as CurrencyCode;
  const tripOpen = access.trip.status === "UPCOMING" || access.trip.status === "ONGOING";
  const financials = await getTripFinancials(tripId);
  const active = financials.participants.filter((p) => p.isActive);
  const inactive = financials.participants.filter((p) => !p.isActive);

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[1.6fr_1fr]">
      <section>
        <h2 className="text-lg font-semibold text-ink">People on this trip</h2>
        <Card className="mt-3 divide-y divide-line">
          {active.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  <Link href={`/trips/${tripId}/participants/${p.id}`} className="truncate hover:text-primary">
                    {p.name}
                  </Link>
                  {p.id === access.participant.id && <Badge tone="primary">You</Badge>}
                  {p.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
                  {!p.userId && <Badge tone="neutral">Guest</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  paid <Money minor={p.paidMinor} currency={currency} /> · share{" "}
                  <Money minor={p.allocatedMinor} currency={currency} />
                </p>
              </div>
              <Money minor={p.outstandingMinor} currency={currency} signed className="text-sm font-semibold" />
              {access.isAdmin && tripOpen && p.id !== access.participant.id && (
                <ParticipantActions tripId={tripId} participantId={p.id} name={p.name} isGuest={!p.userId} />
              )}
            </div>
          ))}
        </Card>

        {inactive.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-soft hover:text-ink">
              Former participants ({inactive.length})
            </summary>
            <Card className="mt-2 divide-y divide-line">
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Avatar name={p.name} size="sm" />
                  <span className="flex-1 font-medium text-ink">{p.name}</span>
                  <Money minor={p.outstandingMinor} currency={currency} signed className="font-medium" />
                  {access.isAdmin && tripOpen && (
                    <ParticipantActions tripId={tripId} participantId={p.id} name={p.name} isGuest={!p.userId} inactive />
                  )}
                </div>
              ))}
            </Card>
            <p className="mt-2 text-xs text-ink-soft">
              Their expense history is preserved; they are only excluded from new expenses.
            </p>
          </details>
        )}
      </section>

      <section className="space-y-6">
        {tripOpen && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Add someone by name</h2>
            <p className="mt-1 text-sm text-ink-soft">No account needed — they can claim their spot later.</p>
            <Card className="mt-3 p-4">
              <AddParticipantForm tripId={tripId} />
            </Card>
          </div>
        )}
        {access.isAdmin && tripOpen && (
          <div>
            <h2 className="text-lg font-semibold text-ink">Invite with a link</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Anyone with the link can join and claim their guest identity. Links expire after 7 days.
            </p>
            <Card className="mt-3 p-4">
              <InviteSection tripId={tripId} />
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
