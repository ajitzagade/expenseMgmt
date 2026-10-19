import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { recordSettlementSchema } from "@/server/schemas";
import { getSettlementState, recordSettlement } from "@/server/services/settlement-service";
import { requireTripAccess } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const state = await getSettlementState(tripId);
  return NextResponse.json(state);
});

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  const input = await parseBody(req, recordSettlementSchema);
  const settlement = await recordSettlement(tripId, user.id, input);
  return NextResponse.json({ settlement }, { status: 201 });
});
