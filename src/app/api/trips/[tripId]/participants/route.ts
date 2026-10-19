import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { addParticipantSchema } from "@/server/schemas";
import { addGuestParticipant } from "@/server/services/participant-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  const { name } = await parseBody(req, addParticipantSchema);
  const participant = await addGuestParticipant(tripId, user.id, name);
  return NextResponse.json({ participant }, { status: 201 });
});
