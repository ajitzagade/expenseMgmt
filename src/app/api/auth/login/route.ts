import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { loginSchema } from "@/server/schemas";
import { verifyLogin } from "@/server/services/auth-service";
import { createSession } from "@/lib/session";

export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit(req, "login", 10, 15 * 60 * 1000);
  const input = await parseBody(req, loginSchema);
  const user = await verifyLogin(input.email, input.password);
  await createSession(user.id);
  return NextResponse.json({ user });
});
