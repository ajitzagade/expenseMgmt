"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function TripTabs({ tripId, isAdmin }: { tripId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/expenses`, label: "Expenses" },
    { href: `${base}/participants`, label: "People" },
    { href: `${base}/settle`, label: "Settle up" },
    { href: `${base}/report`, label: "Report" },
    ...(isAdmin ? [{ href: `${base}/settings`, label: "Settings" }] : []),
  ];
  return (
    <nav aria-label="Trip sections" className="mt-4 -mx-4 overflow-x-auto px-4">
      <div className="flex gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
