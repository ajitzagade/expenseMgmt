import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { requireTripAccess, type TripAccess } from "@/server/services/trip-service";
import { AppError } from "@/server/errors";

/** For pages that require a signed-in user. */
export async function requireUserPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For auth pages that signed-in users should skip. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getSessionUser();
  if (user) redirect("/trips");
}

/** For trip-scoped pages: authn + membership check, 404 for outsiders. */
export async function requireTripPage(tripId: string): Promise<{ user: SessionUser; access: TripAccess }> {
  const user = await requireUserPage();
  try {
    const access = await requireTripAccess(tripId, user.id);
    return { user, access };
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
