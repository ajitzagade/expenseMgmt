import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TripSplit — Trip expense sharing",
    short_name: "TripSplit",
    description: "Track shared trip expenses, see live balances, and settle up with the fewest transfers.",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    background_color: BRAND.page,
    theme_color: BRAND.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
