/**
 * Single source of truth for trip-status semantics, shared by server guards
 * and client/UI code. (Client-safe: no server imports.)
 */
export type TripStatusValue = "UPCOMING" | "ONGOING" | "COMPLETED" | "ARCHIVED";

/** A trip accepts financial writes only while open. */
export function isTripOpen(status: TripStatusValue): boolean {
  return status === "UPCOMING" || status === "ONGOING";
}

export const TRIP_STATUS_META: Record<TripStatusValue, { label: string; tone: "primary" | "accent" | "neutral" }> = {
  UPCOMING: { label: "Upcoming", tone: "primary" },
  ONGOING: { label: "Ongoing", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};
