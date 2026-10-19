import type { ReactNode } from "react";
import { requireTripPage } from "@/lib/guards";
import { Badge } from "@/components/ui";
import { TRIP_COLORS, formatDateRange } from "@/lib/format";
import { TripTabs } from "./trip-tabs";

const statusTone = { UPCOMING: "primary", ONGOING: "accent", COMPLETED: "neutral", ARCHIVED: "neutral" } as const;
const statusLabel = { UPCOMING: "Upcoming", ONGOING: "Ongoing", COMPLETED: "Completed", ARCHIVED: "Archived" } as const;

export default async function TripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { access } = await requireTripPage(tripId);
  const { trip } = access;

  return (
    <div>
      <div className="no-print">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            aria-hidden
            className="size-3.5 rounded-full"
            style={{ backgroundColor: TRIP_COLORS[trip.colorIndex % TRIP_COLORS.length] }}
          />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{trip.name}</h1>
          <Badge tone={statusTone[trip.status]}>{statusLabel[trip.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {trip.destination ? `${trip.destination} · ` : ""}
          {formatDateRange(trip.startDate, trip.endDate)}
        </p>
        <TripTabs tripId={trip.id} isAdmin={access.isAdmin} />
      </div>
      {children}
    </div>
  );
}
