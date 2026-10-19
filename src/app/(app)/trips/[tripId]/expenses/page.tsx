import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { requireTripPage } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { listExpenses } from "@/server/services/expense-service";
import { Avatar, ButtonLink, Card, EmptyState } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDate } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import type { CurrencyCode } from "@/domain/money";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ category?: string; participantId?: string; payerId?: string; q?: string; cursor?: string }>;
}) {
  const { tripId } = await params;
  const filters = await searchParams;
  const { access } = await requireTripPage(tripId);
  const currency = access.trip.currency as CurrencyCode;
  const tripOpen = access.trip.status === "UPCOMING" || access.trip.status === "ONGOING";

  const [participants, { expenses, nextCursor }] = await Promise.all([
    prisma.participant.findMany({ where: { tripId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    listExpenses(tripId, filters),
  ]);

  const hasFilters = Boolean(filters.category || filters.participantId || filters.payerId || filters.q);
  const query = new URLSearchParams(
    Object.entries(filters).filter(([k, v]) => k !== "cursor" && typeof v === "string" && v) as [string, string][],
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Expenses</h2>
        {tripOpen && (
          <ButtonLink href={`/trips/${tripId}/expenses/new`}>
            <Plus className="size-4" aria-hidden />
            Add expense
          </ButtonLink>
        )}
      </div>

      <form method="get" className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search by title…"
          aria-label="Search expenses"
          className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm"
        />
        <select
          name="category"
          defaultValue={filters.category ?? ""}
          aria-label="Filter by category"
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="payerId"
          defaultValue={filters.payerId ?? ""}
          aria-label="Filter by payer"
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
        >
          <option value="">Paid by anyone</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              Paid by {p.name}
            </option>
          ))}
        </select>
        <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filter
        </button>
      </form>
      {hasFilters && (
        <p className="mt-2 text-sm">
          <Link href={`/trips/${tripId}/expenses`} className="font-medium text-primary">
            Clear filters
          </Link>
        </p>
      )}

      {expenses.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={hasFilters ? "Nothing matches these filters" : "No expenses yet"}
            body={hasFilters ? "Try different filters or clear them." : "Every bill you add shows up here."}
            action={
              tripOpen && !hasFilters ? <ButtonLink href={`/trips/${tripId}/expenses/new`}><Plus className="size-4" aria-hidden />Add the first expense</ButtonLink> : undefined
            }
          />
        </div>
      ) : (
        <Card className="mt-4 divide-y divide-line">
          {expenses.map((e) => (
            <Link key={e.id} href={`/trips/${tripId}/expenses/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-page/60">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{e.title}</p>
                <p className="mt-0.5 truncate text-sm text-ink-soft">
                  {formatDate(e.spentAt)} · {e.category} · paid by{" "}
                  {e.payers.map((p) => p.participant.name).join(", ")} · split {e.allocations.filter((a) => a.amountMinor > 0).length}{" "}
                  ways
                </p>
              </div>
              <div className="flex items-center -space-x-1.5" aria-hidden>
                {e.allocations
                  .filter((a) => a.amountMinor > 0)
                  .slice(0, 4)
                  .map((a) => (
                    <Avatar key={a.id} name={a.participant.name} size="sm" />
                  ))}
              </div>
              <Money minor={e.amountMinor} currency={currency} className="font-semibold text-ink" />
            </Link>
          ))}
        </Card>
      )}

      {nextCursor && (
        <div className="mt-4 text-center">
          <Link
            href={`/trips/${tripId}/expenses?${new URLSearchParams([...query.entries(), ["cursor", nextCursor]]).toString()}`}
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            Load older expenses →
          </Link>
        </div>
      )}
    </div>
  );
}
