import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { tripCreateSchema } from "@/server/schemas";
import { createTrip, listTripsForUser } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";

export const GET = withErrorHandling(async (_req: NextRequest) => {
  const user = await requireUser();
  const trips = await listTripsForUser(user.id);
  return NextResponse.json({ trips });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const input = await parseBody(req, tripCreateSchema);
  const trip = await createTrip(user, input);
  return NextResponse.json({ trip }, { status: 201 });
});
