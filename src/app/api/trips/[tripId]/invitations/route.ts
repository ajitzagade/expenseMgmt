import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { createInvitationSchema } from "@/server/schemas";
import { createInvitation, listInvitations } from "@/server/services/invitation-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  const invitations = await listInvitations(tripId, user.id);
  return NextResponse.json({ invitations });
});

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await enforceRateLimit(req, "create-invite", 30, 15 * 60 * 1000);
  const user = await requireUser();
  const { tripId } = await ctx.params;
  const { participantId } = await parseBody(req, createInvitationSchema);
  const { token, expiresAt } = await createInvitation(tripId, user.id, participantId);
  return NextResponse.json({ token, joinPath: `/join/${token}`, expiresAt }, { status: 201 });
});
