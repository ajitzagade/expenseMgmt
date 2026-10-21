"use client";

import { useEffect, useState } from "react";

/** Tells the user when the app is offline (financial actions need the server). */
export function NetworkBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    // text-ink (not text-accent-deep): accent-deep on this background fails
    // WCAG AA contrast (same issue fixed in the Badge "accent" tone).
    <div role="status" className="no-print border-b border-accent bg-accent/60 px-4 py-2 text-center text-sm text-ink">
      You&apos;re offline. You can keep reading, but saving changes needs a connection.
    </div>
  );
}
