import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { assertTripOpen, requireTripAccess, requireTripAdmin } from "./trip-service";
import { logActivity } from "./activity";
import type { Participant } from "@/generated/prisma/client";

/** Any active member can add a guest participant by name. */
export async function addGuestParticipant(tripId: string, userId: string, name: string): Promise<Participant> {
  const { trip } = await requireTripAccess(tripId, userId);
  assertTripOpen(trip);
  const clash = await prisma.participant.findFirst({
    where: { tripId, name: { equals: name, mode: "insensitive" } },
  });
  if (clash) throw AppError.conflict("Someone with this name is already in the trip", "DUPLICATE_PARTICIPANT");
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.create({ data: { tripId, name } });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "PARTICIPANT_ADDED",
      message: `added ${name} to the trip`,
    });
    return participant;
  });
}

/** Admins can rename guest participants (linked users control their own name). */
export async function renameParticipant(
  tripId: string,
  userId: string,
  participantId: string,
  name: string,
): Promise<Participant> {
  await requireTripAdmin(tripId, userId);
  const participant = await prisma.participant.findFirst({ where: { id: participantId, tripId } });
  if (!participant) throw AppError.notFound("Participant not found");
  if (participant.userId) {
    throw AppError.badRequest("Linked participants manage their own name from their profile", "NOT_A_GUEST");
  }
  const clash = await prisma.participant.findFirst({
    where: { tripId, id: { not: participantId }, name: { equals: name, mode: "insensitive" } },
  });
  if (clash) throw AppError.conflict("Someone with this name is already in the trip", "DUPLICATE_PARTICIPANT");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.participant.update({ where: { id: participantId }, data: { name } });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "PARTICIPANT_RENAMED",
      message: `renamed ${participant.name} to ${name}`,
    });
    return updated;
  });
}

async function hasFinancialRecords(participantId: string): Promise<boolean> {
  const [contrib, alloc, from, to, created] = await Promise.all([
    prisma.expensePayerContribution.count({ where: { participantId } }),
    prisma.expenseAllocation.count({ where: { participantId } }),
    prisma.settlement.count({ where: { fromParticipantId: participantId } }),
    prisma.settlement.count({ where: { toParticipantId: participantId } }),
    // Created expenses hold a Restrict FK to the participant: they are
    // financial history too, and hard-deleting would violate the constraint.
    prisma.expense.count({ where: { createdByParticipantId: participantId } }),
  ]);
  return contrib + alloc + from + to + created > 0;
}

/**
 * Safe removal workflow:
 *  - no financial records  -> the participant row is deleted outright;
 *  - has financial records -> soft-deactivated so every expense, allocation
 *    and settlement stays intact and auditable.
 * Returns which path was taken so the UI can word its confirmation honestly.
 */
export async function removeParticipant(
  tripId: string,
  userId: string,
  participantId: string,
): Promise<{ removed: "deleted" | "deactivated" }> {
  const access = await requireTripAdmin(tripId, userId);
  const participant = await prisma.participant.findFirst({ where: { id: participantId, tripId } });
  if (!participant) throw AppError.notFound("Participant not found");
  if (participant.id === access.participant.id) {
    throw AppError.badRequest("You cannot remove yourself: you are the trip admin", "CANNOT_REMOVE_SELF");
  }
  const keepHistory = await hasFinancialRecords(participantId);
  return prisma.$transaction(async (tx) => {
    if (keepHistory) {
      await tx.participant.update({ where: { id: participantId }, data: { isActive: false } });
    } else {
      await tx.participant.delete({ where: { id: participantId } });
    }
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "PARTICIPANT_REMOVED",
      message: keepHistory
        ? `removed ${participant.name} (their expense history is preserved)`
        : `removed ${participant.name}`,
      data: { participantId, keepHistory },
    });
    return { removed: keepHistory ? ("deactivated" as const) : ("deleted" as const) };
  });
}

export async function reactivateParticipant(tripId: string, userId: string, participantId: string): Promise<Participant> {
  await requireTripAdmin(tripId, userId);
  const participant = await prisma.participant.findFirst({ where: { id: participantId, tripId, isActive: false } });
  if (!participant) throw AppError.notFound("Participant not found");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.participant.update({ where: { id: participantId }, data: { isActive: true } });
    await logActivity(tx, {
      tripId,
      actorId: userId,
      type: "PARTICIPANT_REACTIVATED",
      message: `brought ${participant.name} back into the trip`,
    });
    return updated;
  });
}
