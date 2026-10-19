import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUserPage } from "@/lib/guards";
import { listTripsForUser } from "@/server/services/trip-service";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDateRange, TRIP_COLORS } from "@/lib/format";

export const metadata: Metadata = { title: "Your trips" };

const statusTone = { UPCOMING: "primary", ONGOING: "accent", COMPLETED: "neutral", ARCHIVED: "neutral" } as const;
const statusLabel = { UPCOMING: "Upcoming", ONGOING: "Ongoing", COMPLETED: "Completed", ARCHIVED: "Archived" } as const;

export default async function TripsPage() {
  const user = await requireUserPage();
  const trips = await listTripsForUser(user.id);
  const active = trips.filter((t) => t.status !== "ARCHIVED");
  const archived = trips.filter((t) => t.status === "ARCHIVED");

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Your trips</h1>
        <ButtonLink href="/trips/new">
          <Plus className="size-4" aria-hidden />
          New trip
        </ButtonLink>
      </div>

      {trips.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No trips yet"
            body="Create a trip, add your travel mates, and start tracking shared expenses in seconds."
            action={<ButtonLink href="/trips/new"><Plus className="size-4" aria-hidden />Create your first trip</ButtonLink>}
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {active.map((trip) => (
              <li key={trip.id}>
                <Link href={`/trips/${trip.id}`} className="block h-full">
                  <Card className="flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-raised">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="size-3.5 shrink-0 rounded-full"
                          style={{ backgroundColor: TRIP_COLORS[trip.colorIndex % TRIP_COLORS.length] }}
                        />
                        <div>
                          <h2 className="font-medium text-ink">{trip.name}</h2>
                          {trip.destination && <p className="text-sm text-ink-soft">{trip.destination}</p>}
                        </div>
                      </div>
                      <Badge tone={statusTone[trip.status]}>{statusLabel[trip.status]}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-ink-soft">{formatDateRange(trip.startDate, trip.endDate)}</p>
                    <div className="mt-4 flex items-end justify-between border-t border-line pt-3 text-sm text-ink-soft">
                      <span>
                        {trip.participantCount} {trip.participantCount === 1 ? "person" : "people"} · {trip.expenseCount}{" "}
                        {trip.expenseCount === 1 ? "expense" : "expenses"}
                      </span>
                      <Money minor={trip.totalSpentMinor} currency={trip.currency} className="text-base font-semibold text-ink" />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          {archived.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer text-sm font-medium text-ink-soft hover:text-ink">
                Archived trips ({archived.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {archived.map((trip) => (
                  <li key={trip.id}>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm hover:border-primary/40"
                    >
                      <span className="font-medium text-ink">{trip.name}</span>
                      <Money minor={trip.totalSpentMinor} currency={trip.currency} className="text-ink-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
