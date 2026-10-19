import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTrip } from "@/server/services/trip-service";
import { createExpense, deleteExpense, listExpenses } from "@/server/services/expense-service";
import { removeParticipant } from "@/server/services/participant-service";
import { getTripFinancials } from "@/server/services/balance-service";
import { recordSettlement } from "@/server/services/settlement-service";
import { createUser, resetDatabase } from "./helpers";

describe("financial integrity", () => {
  let user: { id: string };
  let tripId: string;
  const pid: Record<string, string> = {};

  beforeAll(async () => {
    await resetDatabase();
    user = await createUser("Owner", "owner@example.com");
    const trip = await createTrip({ id: user.id, name: "Owner" }, {
      name: "Integrity Trip",
      currency: "INR",
      colorIndex: 0,
      participantNames: ["Guest A", "Guest B"],
    });
    tripId = trip.id;
    for (const p of await prisma.participant.findMany({ where: { tripId } })) pid[p.name] = p.id;
  });

  it("rejects an exact split that does not reconcile, writing nothing", async () => {
    const before = await prisma.expense.count({ where: { tripId } });
    await expect(
      createExpense(tripId, user.id, {
        title: "Bad split",
        amountMinor: 10000,
        category: "Food",
        payers: [{ participantId: pid["Owner"], amountMinor: 10000 }],
        splitMethod: "EXACT",
        participants: [
          { participantId: pid["Owner"], exactMinor: 6000 },
          { participantId: pid["Guest A"], exactMinor: 3000 }, // 9000 != 10000
        ],
      }),
    ).rejects.toMatchObject({ code: "SPLIT_TOTAL_MISMATCH" });
    expect(await prisma.expense.count({ where: { tripId } })).toBe(before);
    expect(await prisma.expenseAllocation.count({ where: { expense: { tripId } } })).toBe(0);
  });

  it("rejects payer contributions that do not sum to the total", async () => {
    await expect(
      createExpense(tripId, user.id, {
        title: "Bad payers",
        amountMinor: 10000,
        category: "Food",
        payers: [
          { participantId: pid["Owner"], amountMinor: 4000 },
          { participantId: pid["Guest A"], amountMinor: 4000 },
        ],
        splitMethod: "EQUAL",
        participants: [{ participantId: pid["Owner"] }],
      }),
    ).rejects.toMatchObject({ code: "PAYER_TOTAL_MISMATCH" });
  });

  it("distributes awkward equal splits without losing a paisa", async () => {
    const { expense } = await createExpense(tripId, user.id, {
      title: "₹100 three ways",
      amountMinor: 10000,
      category: "Food",
      payers: [{ participantId: pid["Owner"], amountMinor: 10000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Owner"] }, { participantId: pid["Guest A"] }, { participantId: pid["Guest B"] }],
    });
    expect(expense.allocations.map((a) => a.amountMinor).sort((x, y) => y - x)).toEqual([3334, 3333, 3333]);
    await deleteExpense(tripId, user.id, expense.id);
  });

  it("enforces amount constraints at the database level too", async () => {
    await expect(
      prisma.expense.create({
        data: {
          tripId,
          title: "Negative",
          amountMinor: -500,
          createdByParticipantId: pid["Owner"],
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.settlement.create({
        data: {
          tripId,
          fromParticipantId: pid["Guest A"],
          toParticipantId: pid["Guest A"], // paying yourself
          amountMinor: 100,
          createdByUserId: user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("removes a participant without records outright, but deactivates one with history", async () => {
    // Guest B has no records yet: hard delete.
    const removedB = await removeParticipant(tripId, user.id, pid["Guest B"]);
    expect(removedB.removed).toBe("deleted");
    expect(await prisma.participant.findUnique({ where: { id: pid["Guest B"] } })).toBeNull();

    // Guest A gains history, then removal preserves it.
    const { expense } = await createExpense(tripId, user.id, {
      title: "Guest A's share",
      amountMinor: 5000,
      category: "Food",
      payers: [{ participantId: pid["Owner"], amountMinor: 5000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Guest A"] }],
    });
    const removedA = await removeParticipant(tripId, user.id, pid["Guest A"]);
    expect(removedA.removed).toBe("deactivated");
    const guestA = await prisma.participant.findUniqueOrThrow({ where: { id: pid["Guest A"] } });
    expect(guestA.isActive).toBe(false);
    expect(await prisma.expenseAllocation.count({ where: { expenseId: expense.id } })).toBe(1);

    // Inactive participants still count in balances…
    const fin = await getTripFinancials(tripId);
    expect(fin.participants.find((p) => p.id === pid["Guest A"])!.outstandingMinor).toBe(-5000);
    expect(fin.reconciliationMinor).toBe(0);

    // …but cannot be put on a new expense.
    await expect(
      createExpense(tripId, user.id, {
        title: "After removal",
        amountMinor: 1000,
        category: "Food",
        payers: [{ participantId: pid["Owner"], amountMinor: 1000 }],
        splitMethod: "EQUAL",
        participants: [{ participantId: pid["Guest A"] }],
      }),
    ).rejects.toMatchObject({ code: "INACTIVE_PARTICIPANT" });
  });

  it("validates settlements (distinct parties, members of the trip)", async () => {
    await expect(
      recordSettlement(tripId, user.id, {
        fromParticipantId: pid["Owner"],
        toParticipantId: pid["Owner"],
        amountMinor: 100,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("keeps an audit trail for material changes", async () => {
    const types = (await prisma.activityLog.findMany({ where: { tripId }, select: { type: true } })).map((a) => a.type);
    expect(types).toContain("TRIP_CREATED");
    expect(types).toContain("EXPENSE_ADDED");
    expect(types).toContain("EXPENSE_DELETED");
    expect(types).toContain("PARTICIPANT_REMOVED");
  });

  it("paginates expense history with a stable cursor", async () => {
    for (let i = 0; i < 5; i++) {
      await createExpense(tripId, user.id, {
        title: `Snack ${i}`,
        amountMinor: 100 + i,
        category: "Food",
        payers: [{ participantId: pid["Owner"], amountMinor: 100 + i }],
        splitMethod: "EQUAL",
        participants: [{ participantId: pid["Owner"] }],
      });
    }
    const page1 = await listExpenses(tripId, { limit: 3 });
    expect(page1.expenses.length).toBe(3);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await listExpenses(tripId, { limit: 3, cursor: page1.nextCursor! });
    const ids1 = new Set(page1.expenses.map((e) => e.id));
    for (const e of page2.expenses) expect(ids1.has(e.id)).toBe(false);
  });
});
