import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTrip, updateTrip } from "@/server/services/trip-service";
import { createInvitation, acceptInvitation, getInvitationInfo } from "@/server/services/invitation-service";
import { createExpense } from "@/server/services/expense-service";
import { getTripFinancials } from "@/server/services/balance-service";
import { getSettlementState, recordSettlement, reverseSettlement } from "@/server/services/settlement-service";
import { getTripReport, reportToCsv } from "@/server/services/report-service";
import { AppError } from "@/server/errors";
import { createUser, resetDatabase } from "./helpers";

/**
 * The complete reference journey from the product requirements, executed
 * against the real service layer and Postgres:
 * four friends, five expenses with different sharing rules, live balances,
 * settlement suggestions, partial payments, reversal, and the final report.
 */
describe("Goa Weekend Trip — end to end", () => {
  let ajitUser: { id: string };
  let rahulUser: { id: string };
  let tripId: string;
  const pid: Record<string, string> = {}; // participant ids by name

  beforeAll(async () => {
    await resetDatabase();

    // 1. Ajit signs up and creates the trip with three guests.
    ajitUser = await createUser("Ajit", "ajit@example.com");
    const trip = await createTrip(
      { id: ajitUser.id, name: "Ajit" },
      {
        name: "Goa Weekend Trip",
        destination: "Goa",
        currency: "INR",
        colorIndex: 0,
        participantNames: ["Rahul", "Amit", "Sneha"],
        startDate: "2026-11-06",
        endDate: "2026-11-08",
      },
    );
    tripId = trip.id;
    const participants = await prisma.participant.findMany({ where: { tripId } });
    for (const p of participants) pid[p.name] = p.id;
    expect(Object.keys(pid).sort()).toEqual(["Ajit", "Amit", "Rahul", "Sneha"]);

    // 2. Rahul registers and claims his guest identity through an invite link.
    rahulUser = await createUser("Rahul", "rahul@example.com");
    const { token } = await createInvitation(tripId, ajitUser.id);
    const info = await getInvitationInfo(token, rahulUser.id);
    expect(info.claimableGuests.map((g) => g.name).sort()).toEqual(["Amit", "Rahul", "Sneha"]);
    await acceptInvitation({ id: rahulUser.id, name: "Rahul" }, token, pid["Rahul"]);
    const rahulParticipant = await prisma.participant.findUniqueOrThrow({ where: { id: pid["Rahul"] } });
    expect(rahulParticipant.userId).toBe(rahulUser.id);

    // 3. The five expenses (amounts in paise).
    const everyone = ["Ajit", "Rahul", "Amit", "Sneha"];
    const addExpense = (
      byUserId: string,
      title: string,
      amount: number,
      payerNames: [string, number][],
      sharerNames: string[],
    ) =>
      createExpense(tripId, byUserId, {
        title,
        amountMinor: amount,
        category: "Miscellaneous",
        payers: payerNames.map(([name, amountMinor]) => ({ participantId: pid[name], amountMinor })),
        splitMethod: "EQUAL",
        participants: sharerNames.map((name) => ({ participantId: pid[name] })),
      });

    await addExpense(ajitUser.id, "Hotel", 800000, [["Ajit", 800000]], everyone);
    await addExpense(rahulUser.id, "Dinner", 240000, [["Rahul", 240000]], everyone);
    await addExpense(ajitUser.id, "Drinks", 120000, [["Amit", 120000]], ["Ajit", "Amit"]);
    await addExpense(ajitUser.id, "Taxi", 80000, [["Sneha", 80000]], ["Rahul", "Sneha"]);
    await addExpense(ajitUser.id, "Breakfast", 60000, [["Ajit", 60000]], ["Ajit", "Rahul", "Sneha"]);
  });

  it("computes the documented balances", async () => {
    const fin = await getTripFinancials(tripId);
    const byName = Object.fromEntries(fin.participants.map((p) => [p.name, p]));

    expect(byName["Ajit"]).toMatchObject({ paidMinor: 860000, allocatedMinor: 340000, netMinor: 520000 });
    expect(byName["Rahul"]).toMatchObject({ paidMinor: 240000, allocatedMinor: 320000, netMinor: -80000 });
    expect(byName["Amit"]).toMatchObject({ paidMinor: 120000, allocatedMinor: 320000, netMinor: -200000 });
    expect(byName["Sneha"]).toMatchObject({ paidMinor: 80000, allocatedMinor: 320000, netMinor: -240000 });
    expect(fin.totalSpentMinor).toBe(1300000);
    expect(fin.expenseCount).toBe(5);
    expect(fin.reconciliationMinor).toBe(0);
  });

  it("suggests the documented transfers", async () => {
    const state = await getSettlementState(tripId);
    expect(state.suggestions).toEqual([
      { fromParticipantId: pid["Sneha"], toParticipantId: pid["Ajit"], amountMinor: 240000 },
      { fromParticipantId: pid["Amit"], toParticipantId: pid["Ajit"], amountMinor: 200000 },
      { fromParticipantId: pid["Rahul"], toParticipantId: pid["Ajit"], amountMinor: 80000 },
    ]);
  });

  it("records a partial settlement idempotently", async () => {
    const key = "11111111-1111-4111-8111-111111111111";
    const first = await recordSettlement(tripId, rahulUser.id, {
      fromParticipantId: pid["Amit"],
      toParticipantId: pid["Ajit"],
      amountMinor: 100000,
      method: "UPI",
      idempotencyKey: key,
    });
    // A retried submission with the same key must not double-record.
    const retried = await recordSettlement(tripId, rahulUser.id, {
      fromParticipantId: pid["Amit"],
      toParticipantId: pid["Ajit"],
      amountMinor: 100000,
      idempotencyKey: key,
    });
    expect(retried.id).toBe(first.id);
    expect(await prisma.settlement.count({ where: { tripId } })).toBe(1);

    const state = await getSettlementState(tripId);
    const amit = state.participants.find((p) => p.id === pid["Amit"])!;
    expect(amit.netMinor).toBe(-200000); // net unchanged
    expect(amit.outstandingMinor).toBe(-100000); // outstanding shrank
    expect(state.suggestions).toContainEqual({
      fromParticipantId: pid["Amit"],
      toParticipantId: pid["Ajit"],
      amountMinor: 100000,
    });
  });

  it("reaches zero after the remaining transfers, and reversal restores debt", async () => {
    const state = await getSettlementState(tripId);
    for (const s of state.suggestions) {
      await recordSettlement(tripId, ajitUser.id, {
        fromParticipantId: s.fromParticipantId,
        toParticipantId: s.toParticipantId,
        amountMinor: s.amountMinor,
      });
    }
    let after = await getSettlementState(tripId);
    expect(after.suggestions).toEqual([]);
    for (const p of after.participants) expect(p.outstandingMinor).toBe(0);
    expect(after.reconciliationMinor).toBe(0);

    // Reversing Rahul's payment is an auditable correction, not a delete.
    const rahulPayment = after.recorded.find((r) => r.fromParticipantId === pid["Rahul"] && r.status === "CONFIRMED")!;
    await reverseSettlement(tripId, ajitUser.id, rahulPayment.id, "Recorded by mistake");
    after = await getSettlementState(tripId);
    expect(after.participants.find((p) => p.id === pid["Rahul"])!.outstandingMinor).toBe(-80000);
    expect(after.recorded.find((r) => r.id === rahulPayment.id)!.status).toBe("REVERSED");

    // Record it again for real.
    await recordSettlement(tripId, rahulUser.id, {
      fromParticipantId: pid["Rahul"],
      toParticipantId: pid["Ajit"],
      amountMinor: 80000,
    });
    after = await getSettlementState(tripId);
    for (const p of after.participants) expect(p.outstandingMinor).toBe(0);
  });

  it("produces a complete final report and CSV export", async () => {
    await updateTrip(tripId, ajitUser.id, { status: "COMPLETED" });
    const report = await getTripReport(tripId);
    expect(report.totalSpentMinor).toBe(1300000);
    expect(report.expenseCount).toBe(5);
    expect(report.remainingTransfers).toEqual([]);
    expect(report.completedSettlements.length).toBe(3 + 1); // partial + 2 full + re-recorded

    const csv = reportToCsv(report);
    expect(csv).toContain("Goa Weekend Trip");
    expect(csv).toContain("Ajit,8600.00,3400.00");
    expect(csv).toContain("Drinks");

    // A completed trip rejects new expenses until reopened.
    await expect(
      createExpense(tripId, ajitUser.id, {
        title: "Late entry",
        amountMinor: 100,
        category: "Food",
        payers: [{ participantId: pid["Ajit"], amountMinor: 100 }],
        splitMethod: "EQUAL",
        participants: [{ participantId: pid["Ajit"] }],
      }),
    ).rejects.toMatchObject({ code: "TRIP_CLOSED" });

    // Reopening works and is not a dead end.
    await updateTrip(tripId, ajitUser.id, { status: "ONGOING" });
    await expect(getTripReport(tripId)).resolves.toBeTruthy();
  });

  it("supports a multi-payer expense with a payer outside the split", async () => {
    // Scooter rental ₹1,000: Ajit pays 600, Rahul pays 400, but only
    // Amit and Sneha used the scooters.
    await createExpense(tripId, ajitUser.id, {
      title: "Scooter rental",
      amountMinor: 100000,
      category: "Transport",
      payers: [
        { participantId: pid["Ajit"], amountMinor: 60000 },
        { participantId: pid["Rahul"], amountMinor: 40000 },
      ],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Amit"] }, { participantId: pid["Sneha"] }],
    });
    const fin = await getTripFinancials(tripId);
    const byName = Object.fromEntries(fin.participants.map((p) => [p.name, p]));
    expect(byName["Ajit"].outstandingMinor).toBe(60000);
    expect(byName["Rahul"].outstandingMinor).toBe(40000);
    expect(byName["Amit"].outstandingMinor).toBe(-50000);
    expect(byName["Sneha"].outstandingMinor).toBe(-50000);
    expect(fin.reconciliationMinor).toBe(0);

    await expect(
      prisma.expensePayerContribution.aggregate({
        where: { expense: { tripId, title: "Scooter rental" } },
        _sum: { amountMinor: true },
      }),
    ).resolves.toMatchObject({ _sum: { amountMinor: 100000 } });
  });
});
