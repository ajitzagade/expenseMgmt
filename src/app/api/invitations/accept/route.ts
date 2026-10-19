import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { acceptInvitationSchema } from "@/server/schemas";
import { acceptInvitation } from "@/server/services/invitation-service";
import { requireUser } from "@/lib/session";

export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit(req, "invite-accept", 20, 15 * 60 * 1000);
  const user = await requireUser();
  const { token, claimParticipantId } = await parseBody(req, acceptInvitationSchema);
  const result = await acceptInvitation(user, token, claimParticipantId);
  return NextResponse.json(result);
});
