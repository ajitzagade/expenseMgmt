import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { assertTripOpen, requireTripAdmin } from "./trip-service";
import { logActivity } from "./activity";

const INVITE_DAYS = 7;

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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
      tokenHash: hashInviteToken(token),
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
    where: { tokenHash: hashInviteToken(token) },
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

    if (targetId) {
      const guest = await tx.participant.findFirst({ where: { id: targetId, tripId } });
      const guestName = guest?.name ?? "guest";
      // updateMany's filter guards against two users claiming the same guest:
      // the second caller matches zero rows inside its transaction.
      const claimed = await tx.participant.updateMany({
        where: { id: targetId, tripId, userId: null, isActive: true },
        data: { userId: user.id, name: user.name },
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
      await tx.participant.create({ data: { tripId, userId: user.id, name: user.name } });
      await logActivity(tx, {
        tripId,
        actorId: user.id,
        type: "PARTICIPANT_JOINED",
        message: `${user.name} joined the trip`,
      });
    }
    await tx.tripInvitation.update({ where: { id: invitation.id }, data: { useCount: { increment: 1 } } });
    return { tripId };
  });
}
