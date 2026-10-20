import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, parseBody, withErrorHandling } from "@/server/api";
import { signupSchema } from "@/server/schemas";
import { signUp } from "@/server/services/auth-service";
import { createSession } from "@/lib/session";

export const POST = withErrorHandling(async (req: NextRequest) => {
  await enforceRateLimit(req, "signup", 10, 15 * 60 * 1000);
  const input = await parseBody(req, signupSchema);
  const user = await signUp(input);
  await createSession(user.id);
  return NextResponse.json({ user }, { status: 201 });
});
