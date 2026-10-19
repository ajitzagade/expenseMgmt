import "server-only";
import { prisma } from "@/lib/db";
import { AppError, isUniqueViolation } from "@/server/errors";
import { computeSplit, validatePayerContributions, type SplitMethod, type SplitParticipantInput } from "@/domain/split";
import { assertTripOpen, requireTripAccess, type TripAccess } from "./trip-service";
import { logActivity } from "./activity";
import type { Prisma } from "@/generated/prisma/client";

export interface ExpenseWriteInput {
  title: string;
  amountMinor: number;
  category: string;
  spentAt?: string;
  notes?: string;
  merchant?: string;
  payers: { participantId: string; amountMinor: number }[];
  splitMethod: SplitMethod;
  participants: SplitParticipantInput[];
  /** Create only: client-generated key making creation retry-safe. */
  idempotencyKey?: string;
}

const expenseInclude = {
  payers: { include: { participant: { select: { id: true, name: true } } } },
  allocations: { include: { participant: { select: { id: true, name: true } } } },
  createdByParticipant: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseDetail = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

/**
 * Validates referenced participants and computes the authoritative
 * allocations server-side. The caller's previewed amounts are never trusted.
 */
async function prepareExpense(tripId: string, input: ExpenseWriteInput) {
  const participantIds = new Set([
    ...input.payers.map((p) => p.participantId),
    ...input.participants.map((p) => p.participantId),
  ]);
  const found = await prisma.participant.findMany({
    where: { id: { in: [...participantIds] }, tripId },
    select: { id: true, isActive: true },
  });
  if (found.length !== participantIds.size) {
    throw AppError.badRequest("One or more selected people are not part of this trip", "UNKNOWN_PARTICIPANT");
  }
  const inactive = found.filter((p) => !p.isActive);
  if (inactive.length > 0) {
    throw AppError.badRequest("Removed participants cannot be part of a new or edited expense", "INACTIVE_PARTICIPANT");
  }

  // Authoritative server-side calculation + invariant checks (throws DomainError).
  const allocations = computeSplit({
    method: input.splitMethod,
    amountMinor: input.amountMinor,
    participants: input.participants,
  });
  validatePayerContributions(input.amountMinor, input.payers);

  const weightByParticipant = new Map<string, number | null>(
    input.participants.map((p) => [
      p.participantId,
      input.splitMethod === "PERCENTAGE" ? (p.percentBps ?? null) : input.splitMethod === "SHARES" ? (p.shares ?? null) : null,
    ]),
  );

  return {
    allocationRows: allocations.map((a) => ({
      participantId: a.participantId,
      amountMinor: a.amountMinor,
      weight: weightByParticipant.get(a.participantId) ?? null,
    })),
    payerRows: input.payers.map((p) => ({ participantId: p.participantId, amountMinor: p.amountMinor })),
  };
}

function snapshot(expense: ExpenseDetail): Prisma.InputJsonValue {
  return {
    title: expense.title,
    amountMinor: expense.amountMinor,
    category: expense.category,
    splitMethod: expense.splitMethod,
    spentAt: expense.spentAt.toISOString(),
    notes: expense.notes,
    merchant: expense.merchant,
    payers: expense.payers.map((p) => ({ name: p.participant.name, amountMinor: p.amountMinor })),
    allocations: expense.allocations.map((a) => ({ name: a.participant.name, amountMinor: a.amountMinor })),
  };
}

/**
 * Creates an expense. Idempotent when `idempotencyKey` is provided: a replay
 * returns the originally created expense (`created: false`) instead of a
 * duplicate, and a concurrent duplicate request resolves to the winner's row
 * via the unique constraint rather than failing.
 */
export async function createExpense(
  tripId: string,
  userId: string,
  input: ExpenseWriteInput,
): Promise<{ expense: ExpenseDetail; created: boolean }> {
  const access = await requireTripAccess(tripId, userId);
  assertTripOpen(access.trip);

  const findReplay = () =>
    prisma.expense.findUnique({ where: { idempotencyKey: input.idempotencyKey! }, include: expenseInclude });
  if (input.idempotencyKey) {
    const existing = await findReplay();
    if (existing) {
      // A key from another trip is a client bug or probing — never leak the row.
      if (existing.tripId !== tripId) throw AppError.conflict("Idempotency key already used", "IDEMPOTENCY_REUSE");
      return { expense: existing, created: false };
    }
  }

  const { allocationRows, payerRows } = await prepareExpense(tripId, input);

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          tripId,
          title: input.title,
          amountMinor: input.amountMinor,
          category: input.category,
          spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
          splitMethod: input.splitMethod,
          notes: input.notes,
          merchant: input.merchant,
          createdByParticipantId: access.participant.id,
          idempotencyKey: input.idempotencyKey,
          payers: { create: payerRows },
          allocations: { create: allocationRows },
        },
        include: expenseInclude,
      });
      await logActivity(tx, {
        tripId,
        actorId: userId,
        type: "EXPENSE_ADDED",
        message: `added "${created.title}"`,
        data: snapshot(created),
      });
      return created;
    });
    return { expense, created: true };
  } catch (error) {
    // Concurrent request with the same key won the insert: return its row.
    if (input.idempotencyKey && isUniqueViolation(error, "idempotencyKey")) {
      const winner = await findReplay();
      if (winner && winner.tripId === tripId) return { expense: winner, created: false };
      throw AppError.conflict("Idempotency key already used", "IDEMPOTENCY_REUSE");
    }
    throw error;
  }
}

/** The expense's creator or a trip admin may modify it. */
function assertCanModify(access: TripAccess, expense: { createdByParticipantId: string }): void {
  if (!access.isAdmin && expense.createdByParticipantId !== access.participant.id) {
    throw AppError.forbidden("Only the person who added this expense (or the trip admin) can change it");
  }
}

export async function updateExpense(
  tripId: string,
  userId: string,
  expenseId: string,
  input: ExpenseWriteInput,
): Promise<ExpenseDetail> {
  const access = await requireTripAccess(tripId, userId);
  assertTripOpen(access.trip);
  const existing = await prisma.expense.findFirst({ where: { id: expenseId, tripId }, include: expenseInclude });
  if (!existing) throw AppError.notFound("Expense not found");
  assertCanModify(access, existing);
  const { allocationRows, payerRows } = await prepareExpense(tripId, input);

  return prisma.$transaction(async (tx) => {
    // Replace payer and allocation rows atomically with the expense update.
    await tx.expensePayerContribution.deleteMany({ where: { expenseId } });
    await tx.expenseAllocation.deleteMany({ where: { expenseId } });
    const expense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        title: input.title,
        amountMinor: input.amountMinor,
        category: input.category,
        spentAt: input.spentAt ? new Date(input.spentAt) : existing.spentAt,
        splitMethod: input.splitMethod,
        notes: input.notes ?? null,
        merchant: input.merchant ?? null,
        payers: { create: payerRows },
        allocations: { create: allocationRows },
      },
      include: expenseInclude,
    });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "EXPENSE_UPDATED",
      message: `updated "${expense.title}"`,
      data: { before: snapshot(existing), after: snapshot(expense) },
    });
    return expense;
  });
}

export async function deleteExpense(tripId: string, userId: string, expenseId: string): Promise<void> {
  const access = await requireTripAccess(tripId, userId);
  assertTripOpen(access.trip);
  const existing = await prisma.expense.findFirst({ where: { id: expenseId, tripId }, include: expenseInclude });
  if (!existing) throw AppError.notFound("Expense not found");
  assertCanModify(access, existing);
  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: expenseId } });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "EXPENSE_DELETED",
      message: `deleted "${existing.title}"`,
      data: snapshot(existing),
    });
  });
}

export async function getExpense(tripId: string, expenseId: string): Promise<ExpenseDetail> {
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, tripId }, include: expenseInclude });
  if (!expense) throw AppError.notFound("Expense not found");
  return expense;
}

export interface ExpenseFilters {
  category?: string;
  participantId?: string;
  payerId?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export async function listExpenses(tripId: string, filters: ExpenseFilters) {
  const limit = Math.min(filters.limit ?? 25, 100);
  const where: Prisma.ExpenseWhereInput = {
    tripId,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.participantId ? { allocations: { some: { participantId: filters.participantId, amountMinor: { gt: 0 } } } } : {}),
    ...(filters.payerId ? { payers: { some: { participantId: filters.payerId } } } : {}),
    ...(filters.q ? { title: { contains: filters.q, mode: "insensitive" } } : {}),
  };
  const expenses = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ spentAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });
  const hasMore = expenses.length > limit;
  const page = hasMore ? expenses.slice(0, limit) : expenses;
  return { expenses: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}
