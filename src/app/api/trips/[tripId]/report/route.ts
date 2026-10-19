import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/api";
import { getTripReport, reportToCsv } from "@/server/services/report-service";
import { requireTripAccess } from "@/server/services/trip-service";
import { requireUser } from "@/lib/session";

type Ctx = { params: Promise<{ tripId: string }> };

export const GET = withErrorHandling(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { tripId } = await ctx.params;
  await requireTripAccess(tripId, user.id);
  const report = await getTripReport(tripId);
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const filename = `${report.trip.name.replaceAll(/[^\w-]+/g, "-").toLowerCase()}-report.csv`;
    return new NextResponse(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json(report);
});
