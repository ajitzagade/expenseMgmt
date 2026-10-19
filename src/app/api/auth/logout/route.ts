import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/api";
import { destroySession } from "@/lib/session";

export const POST = withErrorHandling(async (_req: NextRequest) => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
