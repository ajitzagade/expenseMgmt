import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getInvitationInfo } from "@/server/services/invitation-service";
import { AppError } from "@/server/errors";
import { BrandMark } from "@/components/brand";
import { Backdrop } from "@/components/backdrop";
import { ButtonLink, Card } from "@/components/ui";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join trip" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSessionUser();
  let info: Awaited<ReturnType<typeof getInvitationInfo>> | null = null;
  try {
    info = await getInvitationInfo(token, user?.id ?? null);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Backdrop />
      <div className="anim-fade-up mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-xl font-semibold tracking-tight text-ink">TripSplit</span>
      </div>
      <Card className="w-full max-w-sm p-6">
        {!info ? (
          <>
            <h1 className="text-lg font-semibold text-ink">This invite link doesn&apos;t work</h1>
            <p className="mt-2 text-sm text-ink-soft">
              It may have expired, been revoked, or already been used. Ask the trip admin for a fresh link.
            </p>
            <div className="mt-5">
              <ButtonLink href="/" variant="secondary">
                Go to TripSplit
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-ink">You&apos;re invited to “{info.tripName}”</h1>
            {info.destination && <p className="mt-1 text-sm text-ink-soft">{info.destination}</p>}
            {!user ? (
              <>
                <p className="mt-3 text-sm text-ink-soft">Sign in or create a free account to join the trip.</p>
                <div className="mt-5 flex flex-col gap-2">
                  <ButtonLink href={`/signup?next=/join/${token}`}>Create account &amp; join</ButtonLink>
                  <ButtonLink href={`/login?next=/join/${token}`} variant="secondary">
                    I already have an account
                  </ButtonLink>
                </div>
              </>
            ) : info.alreadyMember ? (
              <>
                <p className="mt-3 text-sm text-ink-soft">You&apos;re already part of this trip.</p>
                <div className="mt-5">
                  <ButtonLink href={`/trips/${info.tripId}`}>Open the trip</ButtonLink>
                </div>
              </>
            ) : (
              <JoinForm token={token} claimableGuests={info.claimableGuests} targetParticipant={info.targetParticipant} />
            )}
          </>
        )}
      </Card>
      {!user && (
        <p className="mt-6 text-center text-xs text-ink-soft">
          TripSplit tracks shared trip expenses and settles them fairly.{" "}
          <Link href="/login" className="underline">
            Learn more
          </Link>
        </p>
      )}
    </main>
  );
}
