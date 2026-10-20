import "server-only";
import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/server/token";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { assertTripOpen, requireTripAdmin } from "./trip-service";
import type { Prisma } from "@/generated/prisma/client";
import { logActivity } from "./activity";

const INVITE_DAYS = 7;

/**
 * Creates a shareable invite. The raw token is returned exactly once (it is
 * only stored hashed); the UI builds the /join/<token> link from it.
 * When `participantId` is given the invite claims that guest identity.
 */
export async function createInvitation(
  tripId: string,
  userId: string,
  participantId?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const { trip } = await requireTripAdmin(tripId, userId);
  assertTripOpen(trip);
  if (participantId) {
    const guest = await prisma.participant.findFirst({
      where: { id: participantId, tripId, userId: null, isActive: true },
    });
    if (!guest) throw AppError.badRequest("That participant cannot be claimed", "NOT_CLAIMABLE");
  }
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.tripInvitation.create({
    data: {
      tripId,
      tokenHash: sha256Hex(token),
      createdById: userId,
      participantId,
      expiresAt,
      maxUses: participantId ? 1 : 25,
    },
  });
  return { token, expiresAt };
}

export async function listInvitations(tripId: string, userId: string) {
  await requireTripAdmin(tripId, userId);
  return prisma.tripInvitation.findMany({
    where: { tripId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      useCount: true,
      maxUses: true,
      participant: { select: { id: true, name: true } },
    },
  });
}

export async function revokeInvitation(tripId: string, userId: string, invitationId: string): Promise<void> {
  await requireTripAdmin(tripId, userId);
  const invitation = await prisma.tripInvitation.findFirst({ where: { id: invitationId, tripId } });
  if (!invitation) throw AppError.notFound("Invitation not found");
  await prisma.tripInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
}

async function findUsableInvitation(token: string) {
  const invitation = await prisma.tripInvitation.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { trip: true, participant: { select: { id: true, name: true, userId: true, isActive: true } } },
  });
  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.expiresAt < new Date() ||
    invitation.useCount >= invitation.maxUses
  ) {
    throw AppError.notFound("This invite link is invalid or has expired");
  }
  // A closed trip's roster is final: its invite links stop working.
  assertTripOpen(invitation.trip);
  return invitation;
}

/**
 * Public info shown on the join page. Reveals only what an invitee needs:
 * the trip name and the unclaimed guest identities they could claim.
 */
export async function getInvitationInfo(token: string, userId: string | null) {
  const invitation = await findUsableInvitation(token);
  const alreadyMember = userId
    ? (await prisma.participant.findFirst({ where: { tripId: invitation.tripId, userId, isActive: true } })) !== null
    : false;
  const claimableGuests = invitation.participantId
    ? invitation.participant && !invitation.participant.userId && invitation.participant.isActive
      ? [{ id: invitation.participant.id, name: invitation.participant.name }]
      : []
    : await prisma.participant.findMany({
        where: { tripId: invitation.tripId, userId: null, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
  return {
    tripId: invitation.tripId,
    tripName: invitation.trip.name,
    destination: invitation.trip.destination,
    targetParticipant: invitation.participant ? { id: invitation.participant.id, name: invitation.participant.name } : null,
    claimableGuests,
    alreadyMember,
  };
}

/**
 * Joins the trip. If a claimable guest identity is selected (or the invite
 * targets one), the user takes over that participant — all of its financial
 * history simply becomes theirs, because records reference the participant id.
 */
export async function acceptInvitation(
  user: { id: string; name: string },
  token: string,
  claimParticipantId?: string,
): Promise<{ tripId: string }> {
  const invitation = await findUsableInvitation(token);
  const tripId = invitation.tripId;
  const targetId = invitation.participantId ?? claimParticipantId;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.participant.findFirst({ where: { tripId, userId: user.id } });
    if (existing) {
      if (!existing.isActive) throw AppError.forbidden("You were removed from this trip. Ask the admin to re-invite you.");
      return { tripId }; // Already a member: joining twice is a no-op.
    }

    // Atomic use-count guard: concurrent accepts cannot push past maxUses.
    const reserved = await tx.tripInvitation.updateMany({
      where: { id: invitation.id, useCount: { lt: invitation.maxUses } },
      data: { useCount: { increment: 1 } },
    });
    if (reserved.count !== 1) {
      throw AppError.notFound("This invite link is invalid or has expired");
    }

    if (targetId) {
      const guest = await tx.participant.findFirst({ where: { id: targetId, tripId } });
      const guestName = guest?.name ?? "guest";
      // Keep the guest's name if adopting the account name would collide.
      const claimName = await resolveNameClash(tx, tripId, user.name, targetId);
      // updateMany's filter guards against two users claiming the same guest:
      // the second caller matches zero rows inside its transaction.
      const claimed = await tx.participant.updateMany({
        where: { id: targetId, tripId, userId: null, isActive: true },
        data: { userId: user.id, name: claimName },
      });
      if (claimed.count !== 1) {
        throw AppError.conflict("That identity has already been claimed", "ALREADY_CLAIMED");
      }
      await logActivity(tx, {
        tripId,
        actorId: user.id,
        type: "PARTICIPANT_CLAIMED",
        message: `${user.name} joined and claimed the "${guestName}" spot`,
        data: { participantId: targetId },
      });
    } else {
      const joinName = await resolveNameClash(tx, tripId, user.name, null);
      await tx.participant.create({ data: { tripId, userId: user.id, name: joinName } });
      await logActivity(tx, {
        tripId,
        actorId: user.id,
        type: "PARTICIPANT_JOINED",
        message: `${joinName} joined the trip`,
      });
    }
    return { tripId };
  });
}

/**
 * Per-trip display names stay unique (case-insensitive) so expense lists and
 * settlements are never ambiguous. On a clash, a numeric suffix is added —
 * except when the clashing row is the participant being claimed, whose
 * existing guest name is simply kept.
 */
async function resolveNameClash(
  tx: Prisma.TransactionClient,
  tripId: string,
  desired: string,
  claimingParticipantId: string | null,
): Promise<string> {
  const taken = new Set(
    (await tx.participant.findMany({ where: { tripId, id: { not: claimingParticipantId ?? undefined } }, select: { name: true } })).map(
      (p) => p.name.toLowerCase(),
    ),
  );
  if (!taken.has(desired.toLowerCase())) return desired;
  if (claimingParticipantId) {
    const current = await tx.participant.findUnique({ where: { id: claimingParticipantId }, select: { name: true } });
    if (current) return current.name; // keep the guest's unambiguous name
  }
  for (let n = 2; n < 100; n++) {
    const candidate = `${desired} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return desired;
}
