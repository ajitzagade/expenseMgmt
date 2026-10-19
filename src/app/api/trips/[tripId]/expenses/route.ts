import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { expenseWriteSchema } from "@/server/schemas";
import { createExpense, listExpenses } from "@/server/services/expense-service";
import { requireTripAccess } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

export const GET = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const sp = req.nextUrl.searchParams;
  const result = await listExpenses(tripId, {
    category: sp.get("category") ?? undefined,
    participantId: sp.get("participantId") ?? undefined,
    payerId: sp.get("payerId") ?? undefined,
    q: sp.get("q") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  const input = await parseBody(req, expenseWriteSchema);
  const expense = await createExpense(tripId, user.id, input);
  return NextResponse.json({ expense }, { status: 201 });
});
