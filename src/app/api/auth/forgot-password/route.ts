import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { forgotPasswordSchema } from "@/server/schemas";
import { requestPasswordReset } from "@/server/services/auth-service";

export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit(req, "forgot-password", 5, 15 * 60 * 1000);
  const { email } = await parseBody(req, forgotPasswordSchema);
  await requestPasswordReset(email, req.nextUrl.origin);
  // Always 200: the response never reveals whether an account exists.
  return NextResponse.json({ ok: true });
});
