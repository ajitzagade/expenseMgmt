import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/api";
import { revokeInvitation } from "@/server/services/invitation-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string; invitationId: string }> };

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, invitationId } = await ctx.params;
  await revokeInvitation(tripId, user.id, invitationId);
  return NextResponse.json({ ok: true });
});
