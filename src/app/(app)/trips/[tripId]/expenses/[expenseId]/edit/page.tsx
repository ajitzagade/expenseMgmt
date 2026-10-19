import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTripPage } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getExpense } from "@/server/services/expense-service";
import { AppError } from "@/server/errors";
import { Alert, Card } from "@/components/ui";
import type { CurrencyCode } from "@/domain/money";
import { ExpenseForm } from "../../expense-form";

export const metadata: Metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: { params: Promise<{ tripId: string; expenseId: string }> }) {
  const { tripId, expenseId } = await params;
  const { access } = await requireTripPage(tripId);
  const expense = await getExpense(tripId, expenseId).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const closed = access.trip.status === "COMPLETED" || access.trip.status === "ARCHIVED";
  const canEdit = access.isAdmin || expense.createdByParticipantId === access.participant.id;
  const participants = await prisma.participant.findMany({
    where: { tripId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-ink">Edit expense</h2>
      {closed ? (
        <div className="mt-4">
          <Alert tone="info">This trip is closed. Reopen it from Settings to edit expenses.</Alert>
        </div>
      ) : !canEdit ? (
        <div className="mt-4">
          <Alert tone="info">Only the person who added this expense (or the trip admin) can change it.</Alert>
        </div>
      ) : (
        <Card className="mt-4 p-5">
          <ExpenseForm
            tripId={tripId}
            currency={access.trip.currency as CurrencyCode}
            participants={participants}
            currentParticipantId={access.participant.id}
            initial={{
              id: expense.id,
              title: expense.title,
              amountMinor: expense.amountMinor,
              category: expense.category,
              spentAt: expense.spentAt.toISOString(),
              notes: expense.notes,
              merchant: expense.merchant,
              splitMethod: expense.splitMethod,
              payers: expense.payers.map((p) => ({ participantId: p.participantId, amountMinor: p.amountMinor })),
              allocations: expense.allocations.map((a) => ({
                participantId: a.participantId,
                amountMinor: a.amountMinor,
                weight: a.weight,
              })),
            }}
          />
        </Card>
      )}
    </div>
  );
}
