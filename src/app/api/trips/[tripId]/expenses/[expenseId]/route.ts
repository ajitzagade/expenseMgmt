import { NextRequest, NextResponse } from "next/server";
import { parseBody, withErrorHandling } from "@/server/api";
import { expenseWriteSchema } from "@/server/schemas";
import { deleteExpense, getExpense, updateExpense } from "@/server/services/expense-service";
import { requireTripAccess } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string; expenseId: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, expenseId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const expense = await getExpense(tripId, expenseId);
  return NextResponse.json({ expense });
});

export const PUT = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, expenseId } = await ctx.params;
  const input = await parseBody(req, expenseWriteSchema);
  const expense = await updateExpense(tripId, user.id, expenseId, input);
  return NextResponse.json({ expense });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId, expenseId } = await ctx.params;
  await deleteExpense(tripId, user.id, expenseId);
  return NextResponse.json({ ok: true });
});
