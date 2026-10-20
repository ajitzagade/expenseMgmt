import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTrip, updateTrip } from "@/server/services/trip-service";
import { acceptInvitation, createInvitation } from "@/server/services/invitation-service";
import { createExpense } from "@/server/services/expense-service";
import { removeParticipant } from "@/server/services/participant-service";
import { recordSettlement, reverseSettlement } from "@/server/services/settlement-service";
import { updateProfile } from "@/server/services/auth-service";
import { reportToCsv, type TripReport } from "@/server/services/report-service";
import { rateLimit } from "@/lib/ratelimit";
import { createUser, resetDatabase } from "./helpers";

describe("review-fix regressions", () => {
  let owner: { id: string };
  let friend: { id: string };
  let tripId: string;
  const pid: Record<string, string> = {};

  beforeAll(async () => {
    await resetDatabase();
    owner = await createUser("Owner Om", "om@example.com");
    friend = await createUser("Friend Fia", "fia@example.com");
    const trip = await createTrip({ id: owner.id, name: "Owner Om" }, {
      name: "Fix Trip",
      currency: "INR",
      colorIndex: 0,
      participantNames: ["Guest G"],
    });
    tripId = trip.id;
    const { token } = await createInvitation(tripId, owner.id);
    await acceptInvitation({ id: friend.id, name: "Friend Fia" }, token);
    for (const p of await prisma.participant.findMany({ where: { tripId } })) pid[p.name] = p.id;
  });

  it("deactivates (not crashes on) a participant whose only record is creating an expense", async () => {
    // Fia creates an expense she neither pays nor shares.
    await createExpense(tripId, friend.id, {
      title: "Booked for others",
      amountMinor: 10000,
      category: "Food",
      payers: [{ participantId: pid["Owner Om"], amountMinor: 10000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: pid["Owner Om"] }, { participantId: pid["Guest G"] }],
    });
    const result = await removeParticipant(tripId, owner.id, pid["Friend Fia"]);
    expect(result.removed).toBe("deactivated"); // was: P2003 crash
    const fia = await prisma.participant.findUniqueOrThrow({ where: { id: pid["Friend Fia"] } });
    expect(fia.isActive).toBe(false);
  });

  it("propagates a profile rename to every linked participant", async () => {
    await updateProfile(owner.id, { name: "Om Renamed" });
    const participant = await prisma.participant.findUniqueOrThrow({ where: { id: pid["Owner Om"] } });
    expect(participant.name).toBe("Om Renamed");
  });

  it("blocks invite accepts and settlement reversals on closed trips", async () => {
    const closed = await createTrip({ id: owner.id, name: "Om Renamed" }, {
      name: "Closing Trip",
      currency: "INR",
      colorIndex: 1,
      participantNames: ["Lone Guest"],
    });
    const closedPids = Object.fromEntries(
      (await prisma.participant.findMany({ where: { tripId: closed.id } })).map((p) => [p.name, p.id]),
    );
    await createExpense(closed.id, owner.id, {
      title: "Only bill",
      amountMinor: 4000,
      category: "Food",
      payers: [{ participantId: closedPids["Om Renamed"], amountMinor: 4000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: closedPids["Om Renamed"] }, { participantId: closedPids["Lone Guest"] }],
    });
    const settlement = await recordSettlement(closed.id, owner.id, {
      fromParticipantId: closedPids["Lone Guest"],
      toParticipantId: closedPids["Om Renamed"],
      amountMinor: 2000,
    });
    const { token } = await createInvitation(closed.id, owner.id);
    await updateTrip(closed.id, owner.id, { status: "COMPLETED" });

    // Invite links die with the trip…
    const outsider = await createUser("Late Larry", "larry@example.com");
    await expect(acceptInvitation({ id: outsider.id, name: "Late Larry" }, token)).rejects.toMatchObject({
      code: "TRIP_CLOSED",
    });
    // …and so do reversals of its final balances.
    await expect(reverseSettlement(closed.id, owner.id, settlement.id, "oops")).rejects.toMatchObject({
      code: "TRIP_CLOSED",
    });
  });

  it("suffixes duplicate names when joining via invite", async () => {
    const dupUser = await createUser("Guest G", "dupe@example.com"); // same name as the guest
    const { token } = await createInvitation(tripId, owner.id);
    await acceptInvitation({ id: dupUser.id, name: "Guest G" }, token); // join as self, not claim
    const names = (await prisma.participant.findMany({ where: { tripId } })).map((p) => p.name).sort();
    expect(names).toContain("Guest G");
    expect(names).toContain("Guest G 2");
  });

  it("neutralizes spreadsheet formulas in CSV exports", () => {
    const report = {
      trip: { id: "t", name: "=HYPERLINK(\"https://evil\",\"x\")", destination: "+SUM(A1:A9)", startDate: null, endDate: null, currency: "INR", status: "ONGOING" },
      generatedAt: new Date().toISOString(),
      participants: [],
      totalSpentMinor: 0,
      expenseCount: 0,
      categoryBreakdown: [],
      expenses: [],
      completedSettlements: [],
      remainingTransfers: [],
    } as unknown as TripReport;
    const csv = reportToCsv(report);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+SUM");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    // Negative numbers stay plain numbers.
    expect(csv.split("\n")[4]).toContain("0.00");
  });

  it("rate limiter counts across checks and resets after the window", async () => {
    const key = `test:${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(key, 3, 60_000)).ok).toBe(true);
    }
    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    // Expire the window manually and confirm it resets.
    await prisma.rateLimitBucket.update({ where: { key }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await rateLimit(key, 3, 60_000)).ok).toBe(true);
  });
});
