import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TripSplit — Trip expense sharing",
    short_name: "TripSplit",
    description: "Track shared trip expenses, see live balances, and settle up with the fewest transfers.",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    background_color: "#F7F8F6",
    theme_color: "#176B5B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
