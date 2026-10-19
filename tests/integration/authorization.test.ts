import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTrip, requireTripAccess, updateTrip } from "@/server/services/trip-service";
import { acceptInvitation, createInvitation } from "@/server/services/invitation-service";
import { createExpense, updateExpense } from "@/server/services/expense-service";
import { createUser, resetDatabase } from "./helpers";

describe("authorization boundaries", () => {
  let admin: { id: string };
  let member: { id: string };
  let outsider: { id: string };
  let tripId: string;
  let adminPid: string;
  let memberPid: string;
  let expenseId: string;

  beforeAll(async () => {
    await resetDatabase();
    admin = await createUser("Admin Anu", "anu@example.com");
    member = await createUser("Member Manu", "manu@example.com");
    outsider = await createUser("Outsider Omi", "omi@example.com");

    const trip = await createTrip({ id: admin.id, name: "Admin Anu" }, {
      name: "Boundary Trip",
      currency: "INR",
      colorIndex: 0,
      participantNames: [],
    });
    tripId = trip.id;
    const { token } = await createInvitation(tripId, admin.id);
    await acceptInvitation({ id: member.id, name: "Member Manu" }, token);
    adminPid = (await prisma.participant.findFirstOrThrow({ where: { tripId, userId: admin.id } })).id;
    memberPid = (await prisma.participant.findFirstOrThrow({ where: { tripId, userId: member.id } })).id;

    const { expense } = await createExpense(tripId, admin.id, {
      title: "Admin's expense",
      amountMinor: 10000,
      category: "Food",
      payers: [{ participantId: adminPid, amountMinor: 10000 }],
      splitMethod: "EQUAL",
      participants: [{ participantId: adminPid }, { participantId: memberPid }],
    });
    expenseId = expense.id;
  });

  it("hides trips from non-members (404, not 403)", async () => {
    await expect(requireTripAccess(tripId, outsider.id)).rejects.toMatchObject({ status: 404 });
  });

  it("lets only admins change trip settings", async () => {
    await expect(updateTrip(tripId, member.id, { name: "Hacked" })).rejects.toMatchObject({ status: 403 });
    await expect(updateTrip(tripId, admin.id, { name: "Renamed by admin" })).resolves.toMatchObject({
      name: "Renamed by admin",
    });
  });

  it("blocks members from editing someone else's expense, but allows admins", async () => {
    const edit = {
      title: "Edited",
      amountMinor: 10000,
      category: "Food",
      payers: [{ participantId: adminPid, amountMinor: 10000 }],
      splitMethod: "EQUAL" as const,
      participants: [{ participantId: adminPid }],
    };
    await expect(updateExpense(tripId, member.id, expenseId, edit)).rejects.toMatchObject({ status: 403 });
    await expect(updateExpense(tripId, admin.id, expenseId, edit)).resolves.toMatchObject({ title: "Edited" });
  });

  it("rejects participants from other trips in an expense", async () => {
    const otherTrip = await createTrip({ id: outsider.id, name: "Outsider Omi" }, {
      name: "Other Trip",
      currency: "INR",
      colorIndex: 0,
      participantNames: ["Stranger"],
    });
    const strangerPid = (await prisma.participant.findFirstOrThrow({ where: { tripId: otherTrip.id, userId: null } })).id;
    await expect(
      createExpense(tripId, admin.id, {
        title: "Cross-trip",
        amountMinor: 5000,
        category: "Food",
        payers: [{ participantId: adminPid, amountMinor: 5000 }],
        splitMethod: "EQUAL",
        participants: [{ participantId: strangerPid }],
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_PARTICIPANT" });
  });

  it("prevents double-claiming a guest identity", async () => {
    const trip = await createTrip({ id: admin.id, name: "Admin Anu" }, {
      name: "Claim Trip",
      currency: "INR",
      colorIndex: 0,
      participantNames: ["Ghost"],
    });
    const ghostPid = (await prisma.participant.findFirstOrThrow({ where: { tripId: trip.id, userId: null } })).id;
    const { token } = await createInvitation(trip.id, admin.id);
    await acceptInvitation({ id: member.id, name: "Member Manu" }, token, ghostPid);
    await expect(acceptInvitation({ id: outsider.id, name: "Outsider Omi" }, token, ghostPid)).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
    });
  });

  it("rejects expired and revoked invitations", async () => {
    const { token } = await createInvitation(tripId, admin.id);
    await prisma.tripInvitation.updateMany({ where: { tripId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(acceptInvitation({ id: outsider.id, name: "Outsider Omi" }, token)).rejects.toMatchObject({ status: 404 });
  });
});
