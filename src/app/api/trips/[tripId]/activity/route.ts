import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/api";
import { requireTripAccess } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ tripId: string }> };

export const GET = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 25), 100);
  const cursor = sp.get("cursor");
  const entries = await prisma.activityLog.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { name: true } } },
  });
  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  return NextResponse.json({
    entries: page.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      actorName: a.actor?.name ?? null,
      data: a.data,
      createdAt: a.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});
