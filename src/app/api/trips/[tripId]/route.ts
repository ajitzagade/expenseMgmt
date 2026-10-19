import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { tripUpdateSchema } from "@/server/schemas";
import { requireTripAccess, updateTrip } from "@/server/services/trip-service";
import { getTripOverview } from "@/server/services/balance-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const overview = await getTripOverview(tripId);
  return NextResponse.json(overview);
});

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  const input = await parseBody(req, tripUpdateSchema);
  const trip = await updateTrip(tripId, user.id, input);
  return NextResponse.json({ trip });
});
