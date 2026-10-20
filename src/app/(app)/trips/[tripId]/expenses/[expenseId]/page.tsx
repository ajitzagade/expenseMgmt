import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireTripPage } from "@/lib/guards";
import { isTripOpen } from "@/lib/trip-status";
import { getExpense } from "@/server/services/expense-service";
import { AppError } from "@/server/errors";
import { Avatar, Badge, ButtonLink, Card } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDateTime } from "@/lib/format";
import type { CurrencyCode } from "@/domain/money";
import { DeleteExpenseButton } from "./delete-button";

export const metadata: Metadata = { title: "Expense" };

const methodLabel = {
  EQUAL: "Split equally",
  EXACT: "Exact amounts",
  PERCENTAGE: "By percentage",
  SHARES: "By shares",
  CUSTOM: "Custom split",
} as const;

export default async function ExpenseDetailPage({ params }: { params: Promise<{ tripId: string; expenseId: string }> }) {
  const { tripId, expenseId } = await params;
  const { access } = await requireTripPage(tripId);
  const expense = await getExpense(tripId, expenseId).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const currency = access.trip.currency as CurrencyCode;
  const tripOpen = isTripOpen(access.trip.status);
  const canModify = tripOpen && (access.isAdmin || expense.createdByParticipantId === access.participant.id);
  const sharers = expense.allocations.filter((a) => a.amountMinor > 0);
  const zeroShare = expense.allocations.filter((a) => a.amountMinor === 0);

  return (
    <div className="mx-auto mt-6 max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">{expense.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDateTime(expense.spentAt)}
              {expense.merchant ? ` · ${expense.merchant}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="primary">{expense.category}</Badge>
              <Badge tone="neutral">{methodLabel[expense.splitMethod]}</Badge>
            </div>
          </div>
          <Money minor={expense.amountMinor} currency={currency} className="text-2xl font-semibold text-ink" />
        </div>
        {expense.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{expense.notes}</p>}
        <p className="mt-3 text-xs text-ink-soft">
          Added by {expense.createdByParticipant.name} · last updated {formatDateTime(expense.updatedAt)}
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="font-medium text-ink">Paid by</h3>
        <ul className="mt-2 space-y-2">
          {expense.payers.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-ink">
                <Avatar name={p.participant.name} size="sm" /> {p.participant.name}
              </span>
              <Money minor={p.amountMinor} currency={currency} className="font-medium" />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="font-medium text-ink">Split between {sharers.length} {sharers.length === 1 ? "person" : "people"}</h3>
        <ul className="mt-2 space-y-2">
          {sharers.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-ink">
                <Avatar name={a.participant.name} size="sm" /> {a.participant.name}
                {a.weight != null && expense.splitMethod === "PERCENTAGE" && (
                  <span className="text-xs text-ink-soft">({(a.weight / 100).toFixed(a.weight % 100 === 0 ? 0 : 2)}%)</span>
                )}
                {a.weight != null && expense.splitMethod === "SHARES" && (
                  <span className="text-xs text-ink-soft">({a.weight} {a.weight === 1 ? "share" : "shares"})</span>
                )}
              </span>
              <Money minor={a.amountMinor} currency={currency} className="font-medium" />
            </li>
          ))}
        </ul>
        {zeroShare.length > 0 && (
          <p className="mt-3 text-xs text-ink-soft">Included with a zero share: {zeroShare.map((a) => a.participant.name).join(", ")}</p>
        )}
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
          Shares add up to <Money minor={expense.amountMinor} currency={currency} /> exactly.
        </p>
      </Card>

      {canModify && (
        <div className="flex gap-3">
          <ButtonLink href={`/trips/${tripId}/expenses/${expense.id}/edit`} variant="secondary">
            <Pencil className="size-4" aria-hidden />
            Edit expense
          </ButtonLink>
          <DeleteExpenseButton tripId={tripId} expenseId={expense.id} title={expense.title} />
        </div>
      )}
    </div>
  );
}
