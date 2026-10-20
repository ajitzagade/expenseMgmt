import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { requireTripPage } from "@/lib/guards";
import { isTripOpen } from "@/lib/trip-status";
import { getTripOverview } from "@/server/services/balance-service";
import { Avatar, Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Trip overview" };

export default async function TripDashboardPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  await requireTripPage(tripId);
  const overview = await getTripOverview(tripId);
  const { trip } = overview;
  const currency = trip.currency;
  const activeParticipants = overview.participants.filter((p) => p.isActive);
  const tripOpen = isTripOpen(trip.status);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-soft">Total spent</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            <Money minor={overview.totalSpentMinor} currency={currency} />
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-soft">Expenses</p>
          <p className="mt-1 text-2xl font-semibold tnum text-ink">{overview.expenseCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-soft">People</p>
          <p className="mt-1 text-2xl font-semibold tnum text-ink">{activeParticipants.length}</p>
        </Card>
      </div>

      {tripOpen && (
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/trips/${tripId}/expenses/new`} size="lg">
            <Plus className="size-4" aria-hidden />
            Add expense
          </ButtonLink>
          <ButtonLink href={`/trips/${tripId}/settle`} size="lg" variant="secondary">
            <ArrowLeftRight className="size-4" aria-hidden />
            Settle up
          </ButtonLink>
        </div>
      )}

      <section aria-labelledby="balances-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="balances-heading" className="text-lg font-semibold text-ink">
            Balances
          </h2>
          <Link href={`/trips/${tripId}/settle`} className="text-sm font-medium text-primary hover:text-primary-hover">
            View settlements →
          </Link>
        </div>
        {overview.expenseCount === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No expenses yet"
              body="Add the first bill — hotel, dinner, taxi — and balances will appear here."
              action={tripOpen ? <ButtonLink href={`/trips/${tripId}/expenses/new`}><Plus className="size-4" aria-hidden />Add the first expense</ButtonLink> : undefined}
            />
          </div>
        ) : (
          <Card className="mt-3 divide-y divide-line">
            {overview.participants
              .filter((p) => p.isActive || p.paidMinor > 0 || p.allocatedMinor > 0)
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/trips/${tripId}/participants/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-page/60"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={p.name} />
                    <span className="truncate font-medium text-ink">
                      {p.name}
                      {!p.isActive && <span className="ml-2 text-xs font-normal text-ink-soft">(left trip)</span>}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {p.status === "settled" ? (
                      <Badge tone="neutral">Settled</Badge>
                    ) : (
                      <Badge tone={p.status === "owed" ? "positive" : "negative"}>
                        {p.status === "owed" ? "is owed" : "owes"}
                      </Badge>
                    )}
                    <Money
                      minor={p.status === "owes" ? p.outstandingMinor : Math.abs(p.outstandingMinor)}
                      currency={currency}
                      signed={p.status !== "settled"}
                      className="font-semibold"
                    />
                  </span>
                </Link>
              ))}
          </Card>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="text-lg font-semibold text-ink">
            Spending by category
          </h2>
          {overview.categoryBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Nothing recorded yet.</p>
          ) : (
            <Card className="mt-3 p-4">
              <ul className="space-y-3">
                {overview.categoryBreakdown.map((c) => {
                  const pct = overview.totalSpentMinor > 0 ? (c.totalMinor / overview.totalSpentMinor) * 100 : 0;
                  return (
                    <li key={c.category}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium text-ink">{c.category}</span>
                        <Money minor={c.totalMinor} currency={currency} className="text-ink-soft" />
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/70" role="presentation">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-lg font-semibold text-ink">
            Recent activity
          </h2>
          {overview.recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No activity yet.</p>
          ) : (
            <Card className="mt-3 divide-y divide-line">
              {overview.recentActivity.map((a) => (
                <div key={a.id} className="px-4 py-2.5 text-sm">
                  <p className="text-ink">
                    <span className="font-medium">{a.actorName ?? "Someone"}</span> {a.message}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">{formatDateTime(a.createdAt)}</p>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
