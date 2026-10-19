import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTrip } from "@/server/services/trip-service";
import { createExpense, deleteExpense, updateExpense } from "@/server/services/expense-service";
import { getTripFinancials } from "@/server/services/balance-service";
import { getSettlementState, recordSettlement } from "@/server/services/settlement-service";
import { getTripReport } from "@/server/services/report-service";
import { createUser, resetDatabase } from "./helpers";

describe("edge scenarios", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it("recalculates consistently when an expense changes AFTER settlements were recorded", async () => {
    const user = await createUser("Priya", "priya@example.com");
    const trip = await createTrip({ id: user.id, name: "Priya" }, {
      name: "Edit After Settle",
      currency: "INR",
      colorIndex: 0,
      participantNames: ["Dev"],
    });
    const pid = Object.fromEntries(
      (await prisma.participant.findMany({ where: { tripId: trip.id } })).map((p) => [p.name, p.id]),
    );

    // ₹1,000 paid by Priya, split equally -> Dev owes ₹500.
    const expense = await createExpense(trip.id, user.id, {
      title: "Dinner",
      amountMinor: 100000,
      category: "Food",
      payers: [{ participantId: pid["Priya"], amountMinor: 100000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Priya"] }, { participantId: pid["Dev"] }],
    });
    // Dev settles the full ₹500.
    await recordSettlement(trip.id, user.id, {
      fromParticipantId: pid["Dev"],
      toParticipantId: pid["Priya"],
      amountMinor: 50000,
    });
    let state = await getSettlementState(trip.id);
    expect(state.participants.every((p) => p.outstandingMinor === 0)).toBe(true);

    // The bill was actually ₹1,400 — edit the expense. Dev now owes ₹200 more.
    await updateExpense(trip.id, user.id, expense.id, {
      title: "Dinner (corrected)",
      amountMinor: 140000,
      category: "Food",
      payers: [{ participantId: pid["Priya"], amountMinor: 140000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Priya"] }, { participantId: pid["Dev"] }],
    });
    state = await getSettlementState(trip.id);
    const dev = state.participants.find((p) => p.id === pid["Dev"])!;
    expect(dev.netMinor).toBe(-70000); // new share
    expect(dev.outstandingMinor).toBe(-20000); // settlement still counted
    expect(state.suggestions).toEqual([
      { fromParticipantId: pid["Dev"], toParticipantId: pid["Priya"], amountMinor: 20000 },
    ]);
    expect(state.reconciliationMinor).toBe(0);

    // Deleting the expense entirely flips the direction: Dev has over-paid
    // ₹500 and is now the creditor. The engine must suggest the refund.
    await deleteExpense(trip.id, user.id, expense.id);
    state = await getSettlementState(trip.id);
    expect(state.participants.find((p) => p.id === pid["Dev"])!.outstandingMinor).toBe(50000);
    expect(state.suggestions).toEqual([
      { fromParticipantId: pid["Priya"], toParticipantId: pid["Dev"], amountMinor: 50000 },
    ]);
    expect(state.reconciliationMinor).toBe(0);
  });

  it("supports a one-person trip end to end", async () => {
    const solo = await createUser("Solo", "solo@example.com");
    const trip = await createTrip({ id: solo.id, name: "Solo" }, {
      name: "Solo Trek",
      currency: "INR",
      colorIndex: 2,
      participantNames: [],
    });
    const me = await prisma.participant.findFirstOrThrow({ where: { tripId: trip.id } });
    await createExpense(trip.id, solo.id, {
      title: "Bus ticket",
      amountMinor: 45000,
      category: "Transport",
      payers: [{ participantId: me.id, amountMinor: 45000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: me.id }],
    });
    const fin = await getTripFinancials(trip.id);
    // Paying for your own share nets to zero — nothing to settle, ever.
    expect(fin.participants[0]).toMatchObject({ paidMinor: 45000, allocatedMinor: 45000, outstandingMinor: 0 });
    const state = await getSettlementState(trip.id);
    expect(state.suggestions).toEqual([]);
    const report = await getTripReport(trip.id);
    expect(report.totalSpentMinor).toBe(45000);
    expect(report.remainingTransfers).toEqual([]);
  });

  it("reconciles a large group with an awkward split to the exact paisa", async () => {
    const host = await createUser("Host", "host@example.com");
    const names = Array.from({ length: 12 }, (_, i) => `Friend ${i + 1}`);
    const trip = await createTrip({ id: host.id, name: "Host" }, {
      name: "Big Group",
      currency: "INR",
      colorIndex: 3,
      participantNames: names,
    });
    const participants = await prisma.participant.findMany({ where: { tripId: trip.id } });
    const hostPid = participants.find((p) => p.userId === host.id)!.id;

    // ₹10,000.01 among 13 people: cannot divide evenly; remainder must be
    // distributed deterministically with nothing lost.
    const expense = await createExpense(trip.id, host.id, {
      title: "Houseboat",
      amountMinor: 1000001,
      category: "Accommodation",
      payers: [{ participantId: hostPid, amountMinor: 1000001 }],
      splitMethod: "EQUAL",
      participants: participants.map((p) => ({ participantId: p.id })),
    });
    const total = expense.allocations.reduce((a, x) => a + x.amountMinor, 0);
    expect(total).toBe(1000001);
    const amounts = expense.allocations.map((a) => a.amountMinor);
    expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);

    const fin = await getTripFinancials(trip.id);
    expect(fin.reconciliationMinor).toBe(0);
    const state = await getSettlementState(trip.id);
    // 12 debtors -> 1 creditor: exactly 12 transfers, summing to the host's credit.
    expect(state.suggestions.length).toBe(12);
    expect(state.suggestions.reduce((a, s) => a + s.amountMinor, 0)).toBe(
      fin.participants.find((p) => p.id === hostPid)!.outstandingMinor,
    );
  });

  it("handles over-settlement gracefully (recorded payment larger than the debt)", async () => {
    const a = await createUser("Alpha", "alpha@example.com");
    const trip = await createTrip({ id: a.id, name: "Alpha" }, {
      name: "Overpay",
      currency: "INR",
      colorIndex: 1,
      participantNames: ["Beta"],
    });
    const pid = Object.fromEntries(
      (await prisma.participant.findMany({ where: { tripId: trip.id } })).map((p) => [p.name, p.id]),
    );
    await createExpense(trip.id, a.id, {
      title: "Cab",
      amountMinor: 30000,
      category: "Transport",
      payers: [{ participantId: pid["Alpha"], amountMinor: 30000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Alpha"] }, { participantId: pid["Beta"] }],
    });
    // Beta owes ₹150 but pays ₹200 in cash; the books must show Alpha now
    // owes Beta ₹50 instead of silently absorbing it.
    await recordSettlement(trip.id, a.id, {
      fromParticipantId: pid["Beta"],
      toParticipantId: pid["Alpha"],
      amountMinor: 20000,
    });
    const state = await getSettlementState(trip.id);
    expect(state.participants.find((p) => p.id === pid["Beta"])!.outstandingMinor).toBe(5000);
    expect(state.suggestions).toEqual([
      { fromParticipantId: pid["Alpha"], toParticipantId: pid["Beta"], amountMinor: 5000 },
    ]);
    expect(state.reconciliationMinor).toBe(0);
  });
});
