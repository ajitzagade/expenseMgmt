/**
 * Decorative, fully transparent backdrop: soft color washes plus faint
 * travel-and-money line art (route with waypoints, compass, receipt, coins).
 * Pure decoration — fixed, behind everything, invisible to pointer and
 * screen readers, and calm enough to keep financial figures legible.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Soft translucent washes in the brand palette */}
      <div
        className="absolute -top-40 -right-40 size-[34rem] rounded-full opacity-60"
        style={{ background: "radial-gradient(closest-side, rgb(23 107 91 / 0.10), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-48 -left-32 size-[30rem] rounded-full opacity-70"
        style={{ background: "radial-gradient(closest-side, rgb(232 221 200 / 0.55), transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 left-1/2 size-[26rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(23 107 91 / 0.045), transparent 70%)" }}
      />

      {/* Dashed travel route with waypoints, drifting very slowly */}
      <svg
        className="anim-drift absolute -top-6 right-[4%] h-72 w-[42rem] max-w-[90vw] text-primary"
        viewBox="0 0 680 280"
        fill="none"
      >
        <path
          d="M8 230 C 140 150, 240 260, 350 170 S 560 40, 672 78"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="2"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
        <circle cx="8" cy="230" r="5" fill="currentColor" fillOpacity="0.14" />
        <circle cx="350" cy="170" r="5" fill="currentColor" fillOpacity="0.14" />
        <circle cx="672" cy="78" r="7" fill="currentColor" fillOpacity="0.1" />
        <path
          d="M672 78 l-14 -4 m14 4 l-11 9"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Compass ring */}
      <svg className="absolute bottom-[12%] right-[-3rem] size-56 text-primary max-md:hidden" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="30" stroke="currentColor" strokeOpacity="0.055" strokeWidth="1" strokeDasharray="1 5" />
        <path d="M50 18v8M50 74v8M18 50h8M74 50h8" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M58 42 50 50l-8 8" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Receipt with coin, bottom left */}
      <svg className="absolute bottom-[-2rem] left-[6%] h-64 w-56 text-accent-deep max-sm:hidden" viewBox="0 0 160 190" fill="none">
        <path
          d="M28 10h86v150l-11-8-11 8-10-8-11 8-10-8-11 8-11-8-11 8V10Z"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M44 40h54M44 58h54M44 76h34" stroke="currentColor" strokeOpacity="0.09" strokeWidth="2" strokeLinecap="round" />
        <path d="M44 104h24" stroke="currentColor" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />
        <circle cx="126" cy="152" r="22" stroke="currentColor" strokeOpacity="0.11" strokeWidth="2" />
        <path d="M119 146h14m-14 7h14m-11-7 8 15" stroke="currentColor" strokeOpacity="0.11" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
