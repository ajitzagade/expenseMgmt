import Link from "next/link";
import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/guards";
import { BrandMark } from "@/components/brand";
import { Backdrop } from "@/components/backdrop";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "./sign-out-button";
import { NetworkBanner } from "./network-banner";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUserPage();
  return (
    <div className="min-h-dvh">
      <Backdrop />
      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/trips" className="flex items-center gap-2" aria-label="TripSplit home">
            <BrandMark className="size-7" />
            <span className="text-base font-semibold tracking-tight text-ink max-sm:hidden">TripSplit</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Main">
            <Link href="/trips" className="rounded-lg px-3 py-2 font-semibold text-ink-soft hover:bg-line/50 hover:text-ink">
              Trips
            </Link>
            <Link
              href="/profile"
              aria-label={`Profile (${user.name})`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-ink-soft hover:bg-line/50 hover:text-ink"
            >
              <Avatar name={user.name} size="sm" />
              <span className="max-sm:hidden">{user.name.split(" ")[0]}</span>
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <NetworkBanner />
      <main className="anim-fade-up mx-auto w-full max-w-5xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
