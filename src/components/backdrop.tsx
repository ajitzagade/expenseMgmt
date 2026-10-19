/**
 * Decorative, transparent backdrop: soft color washes plus travel-and-money
 * line art (route with waypoints, compass, receipt with a ₹ coin).
 * Pure decoration — fixed, behind everything, invisible to pointer and
 * screen readers, and calm enough to keep financial figures legible.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Translucent washes in the brand palette */}
      <div
        className="absolute -top-40 -right-40 size-[38rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(23 107 91 / 0.17), transparent 72%)" }}
      />
      <div
        className="absolute -bottom-48 -left-32 size-[34rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(232 221 200 / 0.9), transparent 72%)" }}
      />
      <div
        className="absolute top-1/4 left-1/2 size-[30rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(23 107 91 / 0.08), transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-6rem] right-[10%] size-[24rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(232 221 200 / 0.55), transparent 72%)" }}
      />

      {/* Dashed travel route with waypoints, drifting very slowly */}
      <svg
        className="anim-drift absolute -top-4 right-[2%] h-80 w-[46rem] max-w-[96vw] text-primary"
        viewBox="0 0 680 280"
        fill="none"
      >
        <path
          d="M8 230 C 140 150, 240 260, 350 170 S 560 40, 672 78"
          stroke="currentColor"
          strokeOpacity="0.26"
          strokeWidth="2.5"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
        <circle cx="8" cy="230" r="6" fill="currentColor" fillOpacity="0.3" />
        <circle cx="350" cy="170" r="6" fill="currentColor" fillOpacity="0.3" />
        <circle cx="672" cy="78" r="8" fill="currentColor" fillOpacity="0.24" />
        <path
          d="M672 78 l-16 -5 m16 5 l-13 10"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Compass ring */}
      <svg className="absolute bottom-[10%] right-[-2.5rem] size-64 text-primary max-md:hidden" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="30" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="1 5" />
        <path d="M50 18v8M50 74v8M18 50h8M74 50h8" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M58 42 50 50l-8 8" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Receipt with ₹ coin, bottom left */}
      <svg className="absolute bottom-[-1.5rem] left-[4%] h-72 w-64 text-accent-deep max-sm:hidden" viewBox="0 0 160 190" fill="none">
        <path
          d="M28 10h86v150l-11-8-11 8-10-8-11 8-10-8-11 8-11-8-11 8V10Z"
          stroke="currentColor"
          strokeOpacity="0.26"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M44 40h54M44 58h54M44 76h34" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
        <path d="M44 104h24" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
        <circle cx="126" cy="152" r="22" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
        <path d="M119 146h14m-14 7h14m-11-7 8 15" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
