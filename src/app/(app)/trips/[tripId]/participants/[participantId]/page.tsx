import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTripPage } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getTripFinancials } from "@/server/services/balance-service";
import { Avatar, Badge, Card } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDate } from "@/lib/format";
import type { CurrencyCode } from "@/domain/money";

export const metadata: Metadata = { title: "Participant breakdown" };

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ tripId: string; participantId: string }>;
}) {
  const { tripId, participantId } = await params;
  const { access } = await requireTripPage(tripId);
  const currency = access.trip.currency as CurrencyCode;

  const financials = await getTripFinancials(tripId);
  const person = financials.participants.find((p) => p.id === participantId);
  if (!person) notFound();

  const [allocations, contributions, settlements] = await Promise.all([
    prisma.expenseAllocation.findMany({
      where: { participantId, expense: { tripId } },
      include: { expense: { select: { id: true, title: true, spentAt: true, category: true, amountMinor: true } } },
      orderBy: { expense: { spentAt: "desc" } },
    }),
    prisma.expensePayerContribution.findMany({
      where: { participantId, expense: { tripId } },
      include: { expense: { select: { id: true, title: true, spentAt: true } } },
      orderBy: { expense: { spentAt: "desc" } },
    }),
    prisma.settlement.findMany({
      where: { tripId, status: "CONFIRMED", OR: [{ fromParticipantId: participantId }, { toParticipantId: participantId }] },
      include: { fromParticipant: { select: { name: true } }, toParticipant: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto mt-6 max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <Avatar name={person.name} size="lg" />
          <div>
            <h2 className="text-xl font-semibold text-ink">{person.name}</h2>
            <div className="mt-1 flex gap-2">
              {person.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
              {!person.userId && <Badge tone="neutral">Guest</Badge>}
              {!person.isActive && <Badge tone="neutral">Left trip</Badge>}
              {person.status === "settled" ? (
                <Badge tone="neutral">Settled</Badge>
              ) : (
                <Badge tone={person.status === "owed" ? "positive" : "negative"}>
                  {person.status === "owed" ? "Is owed money" : "Owes money"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <BalanceStat label="Paid toward expenses" minor={person.paidMinor} currency={currency} />
          <BalanceStat label="Share of expenses" minor={person.allocatedMinor} currency={currency} />
          <BalanceStat label="Net balance" minor={person.netMinor} currency={currency} signed />
          <BalanceStat label="Settlements paid" minor={person.settlementsPaidMinor} currency={currency} />
          <BalanceStat label="Settlements received" minor={person.settlementsReceivedMinor} currency={currency} />
          <BalanceStat label="Outstanding now" minor={person.outstandingMinor} currency={currency} signed />
        </dl>
        <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-soft">
          Net balance = paid toward expenses − share of expenses. Outstanding also counts settlement payments made and
          received. A positive figure means money is owed <em>to</em> {person.name}.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="font-medium text-ink">Their share, expense by expense</h3>
        {allocations.filter((a) => a.amountMinor > 0).length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No expenses allocated to {person.name} yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {allocations
              .filter((a) => a.amountMinor > 0)
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/trips/${tripId}/expenses/${a.expense.id}`} className="font-medium text-ink hover:text-primary">
                      {a.expense.title}
                    </Link>
                    <span className="ml-2 text-xs text-ink-soft">{formatDate(a.expense.spentAt)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Money minor={a.amountMinor} currency={currency} className="font-medium" />
                    <span className="ml-1 text-xs text-ink-soft">
                      of <Money minor={a.expense.amountMinor} currency={currency} />
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-medium text-ink">Bills they paid</h3>
        {contributions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">{person.name} hasn&apos;t paid any bills yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {contributions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <Link href={`/trips/${tripId}/expenses/${c.expense.id}`} className="font-medium text-ink hover:text-primary">
                    {c.expense.title}
                  </Link>
                  <span className="ml-2 text-xs text-ink-soft">{formatDate(c.expense.spentAt)}</span>
                </span>
                <Money minor={c.amountMinor} currency={currency} className="font-medium" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {settlements.length > 0 && (
        <Card className="p-5">
          <h3 className="font-medium text-ink">Settlement payments</h3>
          <ul className="mt-2 divide-y divide-line">
            {settlements.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">
                  {s.fromParticipant.name} → {s.toParticipant.name}
                  <span className="ml-2 text-xs text-ink-soft">{formatDate(s.paidAt)}</span>
                </span>
                <Money minor={s.amountMinor} currency={currency} className="font-medium" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function BalanceStat({
  label,
  minor,
  currency,
  signed = false,
}: {
  label: string;
  minor: number;
  currency: CurrencyCode;
  signed?: boolean;
}) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-semibold">
        <Money minor={minor} currency={currency} signed={signed} />
      </dd>
    </div>
  );
}
