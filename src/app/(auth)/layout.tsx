import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { Backdrop } from "@/components/backdrop";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Backdrop />
      <div className="anim-fade-up mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-xl font-semibold tracking-tight text-ink">TripSplit</span>
      </div>
      <div className="anim-fade-up anim-d1 w-full max-w-sm">{children}</div>
      <p className="mt-10 max-w-xs text-center text-xs leading-relaxed text-ink-soft">
        Track shared trip expenses, see who owes whom, and settle up with the fewest transfers.
      </p>
    </main>
  );
}
