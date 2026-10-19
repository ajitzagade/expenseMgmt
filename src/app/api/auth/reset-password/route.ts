import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { resetPasswordSchema } from "@/server/schemas";
import { resetPassword } from "@/server/services/auth-service";

export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit(req, "reset-password", 10, 15 * 60 * 1000);
  const { token, newPassword } = await parseBody(req, resetPasswordSchema);
  await resetPassword(token, newPassword);
  return NextResponse.json({ ok: true });
});
