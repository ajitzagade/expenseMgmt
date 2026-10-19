import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { isSupportedCurrency, type CurrencyCode } from "@/domain/money";
import type { Participant, Trip, TripStatus } from "@/generated/prisma/client";
import { logActivity } from "./activity";

export interface TripAccess {
  trip: Trip;
  participant: Participant;
  isAdmin: boolean;
}

/**
 * Resource-level authorization: every trip-scoped operation goes through one
 * of these. A user has access only through an active participant identity.
 */
export async function requireTripAccess(tripId: string, userId: string): Promise<TripAccess> {
  const participant = await prisma.participant.findFirst({
    where: { tripId, userId, isActive: true },
    include: { trip: true },
  });
  // 404 (not 403) so outsiders cannot probe which trip ids exist.
  if (!participant) throw AppError.notFound("Trip not found");
  const { trip, ...rest } = participant;
  return { trip, participant: rest as Participant, isAdmin: participant.role === "ADMIN" };
}

export async function requireTripAdmin(tripId: string, userId: string): Promise<TripAccess> {
  const access = await requireTripAccess(tripId, userId);
  if (!access.isAdmin) throw AppError.forbidden("Only the trip admin can do this");
  return access;
}

/** Writes to a completed/archived trip must first reopen it. */
export function assertTripOpen(trip: Trip): void {
  if (trip.status === "ARCHIVED" || trip.status === "COMPLETED") {
    throw AppError.conflict(
      "This trip is closed. Reopen it from trip settings to make changes.",
      "TRIP_CLOSED",
    );
  }
}

function initialStatus(startDate?: string, endDate?: string): TripStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (startDate && startDate > today) return "UPCOMING";
  if (endDate && endDate < today) return "COMPLETED";
  if (startDate && startDate <= today) return "ONGOING";
  return "UPCOMING";
}

export interface TripCreateInput {
  name: string;
  destination?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  colorIndex: number;
  participantNames: string[];
}

export async function createTrip(user: { id: string; name: string }, input: TripCreateInput): Promise<Trip> {
  if (!isSupportedCurrency(input.currency)) throw AppError.badRequest("Unsupported currency");
  const guestNames = dedupeNames(input.participantNames, user.name);
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        name: input.name,
        destination: input.destination,
        description: input.description,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        currency: input.currency,
        colorIndex: input.colorIndex,
        status: initialStatus(input.startDate, input.endDate),
        createdById: user.id,
        participants: {
          create: [
            { name: user.name, userId: user.id, role: "ADMIN" },
            ...guestNames.map((name) => ({ name })),
          ],
        },
      },
    });
    await logActivity(tx, {
      tripId: trip.id,
      actorId: user.id,
      type: "TRIP_CREATED",
      message: `created the trip "${trip.name}"`,
    });
    return trip;
  });
}

function dedupeNames(names: string[], creatorName: string): string[] {
  const seen = new Set<string>([creatorName.toLowerCase()]);
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export interface TripSummary {
  id: string;
  name: string;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  currency: CurrencyCode;
  status: TripStatus;
  colorIndex: number;
  participantCount: number;
  expenseCount: number;
  totalSpentMinor: number;
}

export async function listTripsForUser(userId: string): Promise<TripSummary[]> {
  const trips = await prisma.trip.findMany({
    where: { participants: { some: { userId, isActive: true } } },
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      _count: { select: { participants: { where: { isActive: true } }, expenses: true } },
      expenses: { select: { amountMinor: true } },
    },
  });
  return trips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    startDate: t.startDate,
    endDate: t.endDate,
    currency: t.currency as CurrencyCode,
    status: t.status,
    colorIndex: t.colorIndex,
    participantCount: t._count.participants,
    expenseCount: t._count.expenses,
    totalSpentMinor: t.expenses.reduce((a, e) => a + e.amountMinor, 0),
  }));
}

export interface TripUpdateInput {
  name?: string;
  destination?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  colorIndex?: number;
  status?: TripStatus;
}

export async function updateTrip(tripId: string, userId: string, input: TripUpdateInput): Promise<Trip> {
  const { trip } = await requireTripAdmin(tripId, userId);
  const changesDetails = Object.keys(input).some((k) => k !== "status");
  // Closed trips allow exactly one change: reopening (status back to ONGOING/UPCOMING).
  if ((trip.status === "ARCHIVED" || trip.status === "COMPLETED") && changesDetails) {
    assertTripOpen(trip);
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.trip.update({
      where: { id: tripId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.destination !== undefined ? { destination: input.destination } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
        ...(input.colorIndex !== undefined ? { colorIndex: input.colorIndex } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    if (input.status !== undefined && input.status !== trip.status) {
      await logActivity(tx, {
        tripId,
        actorId: userId,
        type: "TRIP_STATUS_CHANGED",
        message: `changed trip status from ${trip.status.toLowerCase()} to ${updated.status.toLowerCase()}`,
        data: { from: trip.status, to: updated.status },
      });
    } else {
      await logActivity(tx, {
        tripId,
        actorId: userId,
        type: "TRIP_UPDATED",
        message: "updated trip details",
      });
    }
    return updated;
  });
}
