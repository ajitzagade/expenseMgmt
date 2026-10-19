import "server-only";
import { prisma } from "@/lib/db";
import { computeBalances, balanceStatus, reconciliationTotal, type ParticipantBalance, type BalanceStatus } from "@/domain/balance";
import type { CurrencyCode } from "@/domain/money";
import type { ParticipantRole, TripStatus } from "@/generated/prisma/client";

export interface ParticipantWithBalance {
  id: string;
  name: string;
  userId: string | null;
  role: ParticipantRole;
  isActive: boolean;
  paidMinor: number;
  allocatedMinor: number;
  settlementsPaidMinor: number;
  settlementsReceivedMinor: number;
  netMinor: number;
  outstandingMinor: number;
  status: BalanceStatus;
}

export interface TripFinancials {
  participants: ParticipantWithBalance[];
  balances: Map<string, ParticipantBalance>;
  totalSpentMinor: number;
  expenseCount: number;
  /** Always 0 when records are consistent; asserted by callers that display money. */
  reconciliationMinor: number;
}

/**
 * Loads the authoritative financial rows for a trip and derives every
 * participant's balance. Inactive participants are included: their history
 * still counts; they are only excluded from NEW expenses.
 */
export async function getTripFinancials(tripId: string): Promise<TripFinancials> {
  const [participants, contributions, allocations, settlements, expenseAgg] = await Promise.all([
    prisma.participant.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } }),
    prisma.expensePayerContribution.findMany({
      where: { expense: { tripId } },
      select: { participantId: true, amountMinor: true },
    }),
    prisma.expenseAllocation.findMany({
      where: { expense: { tripId } },
      select: { participantId: true, amountMinor: true },
    }),
    prisma.settlement.findMany({
      where: { tripId, status: "CONFIRMED" },
      select: { fromParticipantId: true, toParticipantId: true, amountMinor: true },
    }),
    prisma.expense.aggregate({ where: { tripId }, _sum: { amountMinor: true }, _count: true }),
  ]);

  const balances = computeBalances({
    participantIds: participants.map((p) => p.id),
    contributions,
    allocations,
    settlements,
  });

  const withBalances: ParticipantWithBalance[] = participants.map((p) => {
    const b = balances.get(p.id)!;
    return {
      id: p.id,
      name: p.name,
      userId: p.userId,
      role: p.role,
      isActive: p.isActive,
      paidMinor: b.paidMinor,
      allocatedMinor: b.allocatedMinor,
      settlementsPaidMinor: b.settlementsPaidMinor,
      settlementsReceivedMinor: b.settlementsReceivedMinor,
      netMinor: b.netMinor,
      outstandingMinor: b.outstandingMinor,
      status: balanceStatus(b.outstandingMinor),
    };
  });

  return {
    participants: withBalances,
    balances,
    totalSpentMinor: expenseAgg._sum.amountMinor ?? 0,
    expenseCount: expenseAgg._count,
    reconciliationMinor: reconciliationTotal(balances.values()),
  };
}

export interface TripOverview {
  trip: {
    id: string;
    name: string;
    destination: string | null;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    currency: CurrencyCode;
    status: TripStatus;
    colorIndex: number;
    createdById: string;
  };
  participants: ParticipantWithBalance[];
  totalSpentMinor: number;
  expenseCount: number;
  categoryBreakdown: { category: string; totalMinor: number; count: number }[];
  recentActivity: { id: string; type: string; message: string; actorName: string | null; createdAt: string }[];
}

export async function getTripOverview(tripId: string): Promise<TripOverview> {
  const [trip, financials, categories, activity] = await Promise.all([
    prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
    getTripFinancials(tripId),
    prisma.expense.groupBy({
      by: ["category"],
      where: { tripId },
      _sum: { amountMinor: true },
      _count: true,
      orderBy: { _sum: { amountMinor: "desc" } },
    }),
    prisma.activityLog.findMany({
      where: { tripId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      description: trip.description,
      startDate: trip.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: trip.endDate?.toISOString().slice(0, 10) ?? null,
      currency: trip.currency as CurrencyCode,
      status: trip.status,
      colorIndex: trip.colorIndex,
      createdById: trip.createdById,
    },
    participants: financials.participants,
    totalSpentMinor: financials.totalSpentMinor,
    expenseCount: financials.expenseCount,
    categoryBreakdown: categories.map((c) => ({
      category: c.category,
      totalMinor: c._sum.amountMinor ?? 0,
      count: c._count,
    })),
    recentActivity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      actorName: a.actor?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
