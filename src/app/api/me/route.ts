import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { updateProfileSchema } from "@/server/schemas";
import { updateProfile } from "@/server/services/auth-service";
import { requireUser } from "@/lib/session";

export const GET = withErrorHandling(async (_req: NextRequest) => {
  const user = await requireUser();
  return NextResponse.json({ user });
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const input = await parseBody(req, updateProfileSchema);
  const updated = await updateProfile(user.id, input);
  return NextResponse.json({ user: updated });
});
