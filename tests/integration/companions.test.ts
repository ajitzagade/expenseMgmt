import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTrip, getKnownCompanions } from "@/server/services/trip-service";
import { acceptInvitation, createInvitation } from "@/server/services/invitation-service";
import { createUser, resetDatabase } from "./helpers";

describe("known companions on trip creation", () => {
  let asha: { id: string };
  let vikram: { id: string };
  let stranger: { id: string };

  beforeAll(async () => {
    await resetDatabase();
    asha = await createUser("Asha", "asha@example.com");
    vikram = await createUser("Vikram", "vikram@example.com");
    stranger = await createUser("Stranger", "stranger@example.com");

    // Asha and Vikram share a past trip that also had a guest, Meera.
    const past = await createTrip({ id: asha.id, name: "Asha" }, {
      name: "Past Trip",
      currency: "INR",
      colorIndex: 0,
      participantNames: ["Meera"],
    });
    const { token } = await createInvitation(past.id, asha.id);
    await acceptInvitation({ id: vikram.id, name: "Vikram" }, token);
  });

  it("lists registered companions and past guests, excluding the user", async () => {
    const companions = await getKnownCompanions(asha.id);
    expect(companions.map((c) => c.name).sort()).toEqual(["Meera", "Vikram"]);
    const vikramEntry = companions.find((c) => c.name === "Vikram")!;
    expect(vikramEntry.userId).toBe(vikram.id);
    expect(companions.find((c) => c.name === "Meera")!.userId).toBeNull();
  });

  it("pre-adds a registered companion as a linked member", async () => {
    const trip = await createTrip({ id: asha.id, name: "Asha" }, {
      name: "Next Trip",
      currency: "INR",
      colorIndex: 1,
      participantNames: ["Meera"],
      companionUserIds: [vikram.id],
    });
    const participants = await prisma.participant.findMany({ where: { tripId: trip.id }, orderBy: { name: "asc" } });
    expect(participants.map((p) => [p.name, p.userId ?? "guest"])).toEqual([
      ["Asha", asha.id],
      ["Meera", "guest"],
      ["Vikram", vikram.id],
    ]);
    // Vikram sees the new trip immediately — no invitation round-trip needed.
    const vikramParticipant = participants.find((p) => p.userId === vikram.id)!;
    expect(vikramParticipant.role).toBe("MEMBER");
  });

  it("rejects pre-adding users who never shared a trip with the creator", async () => {
    await expect(
      createTrip({ id: asha.id, name: "Asha" }, {
        name: "Sneaky Trip",
        currency: "INR",
        colorIndex: 0,
        participantNames: [],
        companionUserIds: [stranger.id],
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_COMPANION" });
  });
});
