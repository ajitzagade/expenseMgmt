import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { reverseSettlementSchema } from "@/server/schemas";
import { reverseSettlement } from "@/server/services/settlement-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string; settlementId: string }> };

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, settlementId } = await ctx.params;
  const { reason } = await parseBody(req, reverseSettlementSchema);
  const settlement = await reverseSettlement(tripId, user.id, settlementId, reason);
  return NextResponse.json({ settlement });
});
