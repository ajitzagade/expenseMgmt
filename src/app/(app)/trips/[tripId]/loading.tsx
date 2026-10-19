import { Spinner } from "@/components/ui";

/** Instant feedback while a trip tab's data loads. */
export default function TripSectionLoading() {
  return (
    <div className="flex justify-center py-20">
      <Spinner />
    </div>
  );
}
