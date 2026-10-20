import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { changePasswordSchema } from "@/server/schemas";
import { changePassword } from "@/server/services/auth-service";
import { createSession, requireUser } from "@/lib/session";

export const POST = withErrorHandling(async (req: NextRequest) => {
  await enforceRateLimit(req, "change-password", 10, 15 * 60 * 1000);
  const user = await requireUser();
  const input = await parseBody(req, changePasswordSchema);
  await changePassword(user.id, input.currentPassword, input.newPassword);
  // changePassword revokes every session; issue a fresh one for this device.
  await createSession(user.id);
  return NextResponse.json({ ok: true });
});
