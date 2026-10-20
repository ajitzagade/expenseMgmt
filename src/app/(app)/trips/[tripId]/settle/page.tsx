import type { Metadata } from "next";
import { requireTripPage } from "@/lib/guards";
import { isTripOpen } from "@/lib/trip-status";
import { getSettlementState } from "@/server/services/settlement-service";
import { Avatar, Badge, Card, EmptyState } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDate } from "@/lib/format";
import type { CurrencyCode } from "@/domain/money";
import { RecordPaymentPanel, ReverseSettlementButton } from "./settle-client";

export const metadata: Metadata = { title: "Settle up" };

export default async function SettlePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { access } = await requireTripPage(tripId);
  const currency = access.trip.currency as CurrencyCode;
  const tripOpen = isTripOpen(access.trip.status);
  const state = await getSettlementState(tripId);
  const unsettled = state.participants.filter((p) => p.status !== "settled");
  // The payment form must cover everyone a suggestion can reference —
  // including removed participants, whose debts are still real.
  const formParticipants = state.participants
    .filter((p) => p.isActive || p.outstandingMinor !== 0)
    .map((p) => ({ id: p.id, name: p.isActive ? p.name : `${p.name} (left trip)` }));

  return (
    <div className="mt-6 space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-ink">Where everyone stands</h2>
        {unsettled.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="All settled 🎉" body="Nobody owes anything on this trip right now." />
          </div>
        ) : (
          <Card className="mt-3 divide-y divide-line">
            {unsettled.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 font-medium text-ink">
                  <Avatar name={p.name} /> {p.name}
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={p.status === "owed" ? "positive" : "negative"}>{p.status === "owed" ? "is owed" : "owes"}</Badge>
                  <Money minor={p.outstandingMinor} currency={currency} signed className="font-semibold" />
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Suggested transfers</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The fewest practical payments to settle the trip. These are recommendations — record a payment once it actually
          happens (partial amounts are fine).
        </p>
        {state.suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nothing to transfer.</p>
        ) : (
          <RecordPaymentPanel
            tripId={tripId}
            currency={currency}
            canRecord={tripOpen}
            participants={formParticipants}
            suggestions={state.suggestions.map((s) => ({
              fromParticipantId: s.fromParticipantId,
              toParticipantId: s.toParticipantId,
              amountMinor: s.amountMinor,
              fromName: state.participants.find((p) => p.id === s.fromParticipantId)?.name ?? "?",
              toName: state.participants.find((p) => p.id === s.toParticipantId)?.name ?? "?",
            }))}
          />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Recorded payments</h2>
        {state.recorded.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No payments recorded yet.</p>
        ) : (
          <Card className="mt-3 divide-y divide-line">
            {state.recorded.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">
                    {s.fromName} paid {s.toName}
                  </span>
                  <span className="ml-2 text-xs text-ink-soft">
                    {formatDate(s.paidAt)}
                    {s.method ? ` · ${s.method}` : ""}
                    {s.note ? ` · ${s.note}` : ""}
                  </span>
                  {s.status === "REVERSED" && (
                    <span className="ml-2">
                      <Badge tone="negative">Reversed{s.reversalReason ? `: ${s.reversalReason}` : ""}</Badge>
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center justify-end gap-3">
                  <Money
                    minor={s.amountMinor}
                    currency={currency}
                    className={s.status === "REVERSED" ? "text-ink-soft line-through" : "font-semibold"}
                  />
                  {s.status === "CONFIRMED" && tripOpen && <ReverseSettlementButton tripId={tripId} settlementId={s.id} />}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
