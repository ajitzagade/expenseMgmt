import type { Metadata } from "next";
import { requireTripPage } from "@/lib/guards";
import { isTripOpen } from "@/lib/trip-status";
import { Alert, Card } from "@/components/ui";
import { TripSettingsForm, TripStatusControls } from "./settings-client";

export const metadata: Metadata = { title: "Trip settings" };

export default async function TripSettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { access } = await requireTripPage(tripId);
  const { trip } = access;

  if (!access.isAdmin) {
    return (
      <div className="mt-6">
        <Alert tone="info">Only the trip admin can change trip settings.</Alert>
      </div>
    );
  }

  const closed = !isTripOpen(trip.status);

  return (
    <div className="mx-auto mt-6 max-w-xl space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-ink">Trip details</h2>
        {closed ? (
          <div className="mt-3">
            <Alert tone="info">This trip is {trip.status.toLowerCase()}. Reopen it below to edit details or records.</Alert>
          </div>
        ) : (
          <Card className="mt-3 p-5">
            <TripSettingsForm
              tripId={trip.id}
              initial={{
                name: trip.name,
                destination: trip.destination ?? "",
                description: trip.description ?? "",
                startDate: trip.startDate?.toISOString().slice(0, 10) ?? "",
                endDate: trip.endDate?.toISOString().slice(0, 10) ?? "",
                colorIndex: trip.colorIndex,
              }}
            />
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Trip status</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Completing or archiving a trip locks expenses and payments. You can always reopen it — records are never frozen
          beyond recovery, and every change stays in the audit history.
        </p>
        <Card className="mt-3 p-5">
          <TripStatusControls tripId={trip.id} status={trip.status} />
        </Card>
      </section>

      <p className="text-xs text-ink-soft">
        Trip currency is fixed at creation ({trip.currency}) so that every recorded amount stays comparable.
      </p>
    </div>
  );
}
