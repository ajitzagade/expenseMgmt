import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, withErrorHandling } from "@/server/api";
import { getInvitationInfo } from "@/server/services/invitation-service";
import { getSessionUser } from "@/lib/session";

type Ctx = { params: Promise<{ token: string }> };

export const GET = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  await enforceRateLimit(req, "invite-info", 30, 15 * 60 * 1000);
  const user = await getSessionUser();
  const { token } = await ctx.params;
  const info = await getInvitationInfo(token, user?.id ?? null);
  return NextResponse.json(info);
});
