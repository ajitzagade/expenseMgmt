import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { splitPreviewSchema } from "@/server/schemas";
import { computeSplit } from "@/domain/split";
import { requireTripAccess } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

/**
 * Authoritative split preview: the UI shows exactly what the server would
 * save. (The same engine runs again on create/update — client values are
 * never trusted.)
 */
export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const input = await parseBody(req, splitPreviewSchema);
  const allocations = computeSplit({
    method: input.splitMethod,
    amountMinor: input.amountMinor,
    participants: input.participants,
  });
  return NextResponse.json({ allocations });
});
