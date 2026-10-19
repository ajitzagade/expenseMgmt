import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { suggestSettlements, type SuggestedTransfer } from "@/domain/settlement";
import { assertTripOpen, requireTripAccess } from "./trip-service";
import { getTripFinancials, type ParticipantWithBalance } from "./balance-service";
import { logActivity } from "./activity";
import type { Settlement } from "@/generated/prisma/client";

export interface SettlementState {
  participants: ParticipantWithBalance[];
  /** Recommendations computed from current outstanding balances. */
  suggestions: SuggestedTransfer[];
  /** Recorded payments, newest first (confirmed and reversed). */
  recorded: (Settlement & { fromName: string; toName: string })[];
  reconciliationMinor: number;
}

export async function getSettlementState(tripId: string): Promise<SettlementState> {
  const financials = await getTripFinancials(tripId);
  const recorded = await prisma.settlement.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
    include: {
      fromParticipant: { select: { name: true } },
      toParticipant: { select: { name: true } },
    },
  });
  return {
    participants: financials.participants,
    suggestions: suggestSettlements(financials.balances.values()),
    recorded: recorded.map(({ fromParticipant, toParticipant, ...s }) => ({
      ...s,
      fromName: fromParticipant.name,
      toName: toParticipant.name,
    })),
    reconciliationMinor: financials.reconciliationMinor,
  };
}

export interface RecordSettlementInput {
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
  method?: string;
  note?: string;
  paidAt?: string;
  idempotencyKey?: string;
}

/**
 * Records a real payment between two participants (full or partial).
 * Idempotent: retrying with the same idempotencyKey returns the original row.
 */
export async function recordSettlement(tripId: string, userId: string, input: RecordSettlementInput): Promise<Settlement> {
  const access = await requireTripAccess(tripId, userId);
  assertTripOpen(access.trip);
  if (input.fromParticipantId === input.toParticipantId) {
    throw AppError.badRequest("Payer and recipient must be different people");
  }
  if (input.idempotencyKey) {
    const existing = await prisma.settlement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.tripId !== tripId) throw AppError.conflict("Idempotency key already used", "IDEMPOTENCY_REUSE");
      return existing;
    }
  }
  const parties = await prisma.participant.findMany({
    where: { id: { in: [input.fromParticipantId, input.toParticipantId] }, tripId },
    select: { id: true, name: true },
  });
  if (parties.length !== 2) {
    throw AppError.badRequest("Both people must be part of this trip", "UNKNOWN_PARTICIPANT");
  }
  const nameOf = new Map(parties.map((p) => [p.id, p.name]));

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        tripId,
        fromParticipantId: input.fromParticipantId,
        toParticipantId: input.toParticipantId,
        amountMinor: input.amountMinor,
        method: input.method,
        note: input.note,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        idempotencyKey: input.idempotencyKey,
        createdByUserId: userId,
      },
    });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "SETTLEMENT_RECORDED",
      message: `recorded a payment: ${nameOf.get(input.fromParticipantId)} paid ${nameOf.get(input.toParticipantId)}`,
      data: { settlementId: settlement.id, amountMinor: input.amountMinor },
    });
    return settlement;
  });
}

/**
 * Auditable correction: the payment row is never deleted, it is marked
 * REVERSED (and stops counting toward balances). Admins or the member who
 * recorded the payment can reverse it.
 */
export async function reverseSettlement(tripId: string, userId: string, settlementId: string, reason: string): Promise<Settlement> {
  const access = await requireTripAccess(tripId, userId);
  const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, tripId } });
  if (!settlement) throw AppError.notFound("Payment not found");
  if (settlement.status === "REVERSED") throw AppError.conflict("This payment is already reversed", "ALREADY_REVERSED");
  if (!access.isAdmin && settlement.createdByUserId !== userId) {
    throw AppError.forbidden("Only the person who recorded this payment (or the trip admin) can reverse it");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: "REVERSED", reversedAt: new Date(), reversalReason: reason },
    });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "SETTLEMENT_REVERSED",
      message: `reversed a recorded payment (${reason})`,
      data: { settlementId, amountMinor: settlement.amountMinor },
    });
    return updated;
  });
}
