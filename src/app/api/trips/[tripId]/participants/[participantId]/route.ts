import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { renameParticipantSchema } from "@/server/schemas";
import { reactivateParticipant, removeParticipant, renameParticipant } from "@/server/services/participant-service";
import { requireUser } from "@/lib/session";
import { z } from "zod";

type Ctx = { params: Promise<{ tripId: string; participantId: string }> };

const patchSchema = z.union([
  renameParticipantSchema,
  z.object({ reactivate: z.literal(true) }),
]);

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, participantId } = await ctx.params;
  const input = await parseBody(req, patchSchema);
  const participant =
    "reactivate" in input
      ? await reactivateParticipant(tripId, user.id, participantId)
      : await renameParticipant(tripId, user.id, participantId, input.name);
  return NextResponse.json({ participant });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, participantId } = await ctx.params;
  const result = await removeParticipant(tripId, user.id, participantId);
  return NextResponse.json(result);
});
