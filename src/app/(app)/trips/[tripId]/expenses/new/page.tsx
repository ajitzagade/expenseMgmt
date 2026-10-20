import type { Metadata } from "next";
import { requireTripPage } from "@/lib/guards";
import { isTripOpen } from "@/lib/trip-status";
import { prisma } from "@/lib/db";
import { Alert, Card } from "@/components/ui";
import type { CurrencyCode } from "@/domain/money";
import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { access } = await requireTripPage(tripId);
  const closed = !isTripOpen(access.trip.status);
  const participants = await prisma.participant.findMany({
    where: { tripId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-ink">Add an expense</h2>
      {closed ? (
        <div className="mt-4">
          <Alert tone="info">This trip is closed. Reopen it from Settings to add expenses.</Alert>
        </div>
      ) : (
        <Card className="mt-4 p-5">
          <ExpenseForm
            tripId={tripId}
            currency={access.trip.currency as CurrencyCode}
            participants={participants}
            currentParticipantId={access.participant.id}
          />
        </Card>
      )}
    </div>
  );
}
