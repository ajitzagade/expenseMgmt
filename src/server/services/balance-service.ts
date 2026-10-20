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
  // Aggregated in the database: one row per participant (or settlement pair)
  // regardless of how many expenses the trip has.
  const [participants, contribSums, allocSums, settlementSums, expenseAgg] = await Promise.all([
    prisma.participant.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } }),
    prisma.expensePayerContribution.groupBy({
      by: ["participantId"],
      where: { expense: { tripId } },
      _sum: { amountMinor: true },
    }),
    prisma.expenseAllocation.groupBy({
      by: ["participantId"],
      where: { expense: { tripId } },
      _sum: { amountMinor: true },
    }),
    prisma.settlement.groupBy({
      by: ["fromParticipantId", "toParticipantId"],
      where: { tripId, status: "CONFIRMED" },
      _sum: { amountMinor: true },
    }),
    prisma.expense.aggregate({ where: { tripId }, _sum: { amountMinor: true }, _count: true }),
  ]);

  const balances = computeBalances({
    participantIds: participants.map((p) => p.id),
    contributions: contribSums.map((r) => ({ participantId: r.participantId, amountMinor: r._sum.amountMinor ?? 0 })),
    allocations: allocSums.map((r) => ({ participantId: r.participantId, amountMinor: r._sum.amountMinor ?? 0 })),
    settlements: settlementSums.map((r) => ({
      fromParticipantId: r.fromParticipantId,
      toParticipantId: r.toParticipantId,
      amountMinor: r._sum.amountMinor ?? 0,
    })),
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

/** Per-category totals, shared by the dashboard and the final report. */
export async function getCategoryBreakdown(
  tripId: string,
): Promise<{ category: string; totalMinor: number; count: number }[]> {
  const rows = await prisma.expense.groupBy({
    by: ["category"],
    where: { tripId },
    _sum: { amountMinor: true },
    _count: true,
    orderBy: { _sum: { amountMinor: "desc" } },
  });
  return rows.map((c) => ({ category: c.category, totalMinor: c._sum.amountMinor ?? 0, count: c._count }));
}

export async function getTripOverview(tripId: string): Promise<TripOverview> {
  const [trip, financials, categoryBreakdown, activity] = await Promise.all([
    prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
    getTripFinancials(tripId),
    getCategoryBreakdown(tripId),
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
    categoryBreakdown,
    recentActivity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      actorName: a.actor?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
