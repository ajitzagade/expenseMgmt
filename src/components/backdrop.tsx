/**
 * Full-page decorative background, designed to read as one cohesive scene:
 *  1. a faint cartographic dot grid across the entire page (map texture),
 *  2. a soft teal wash falling from the top,
 *  3. a full-width layered mountain range along the bottom with a dashed
 *     travel route and sun.
 * Pure decoration — fixed, behind everything, invisible to pointers and
 * screen readers, and quiet enough to keep financial figures legible.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Map-style dot grid over the whole page */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgb(23 107 91 / 0.085) 1.1px, transparent 1.1px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(to bottom, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.95))",
          WebkitMaskImage: "linear-gradient(to bottom, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.95))",
        }}
      />

      {/* Soft washes: teal from the top, sand glow low-left */}
      <div
        className="absolute inset-x-0 top-0 h-80"
        style={{ background: "linear-gradient(to bottom, rgb(23 107 91 / 0.09), transparent)" }}
      />
      <div
        className="absolute bottom-[-8rem] left-[-10rem] size-[36rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(232 221 200 / 0.8), transparent 70%)" }}
      />

      {/* Sun above the range */}
      <div
        className="absolute right-[14%] bottom-[30vh] size-40 rounded-full max-md:size-28"
        style={{ background: "radial-gradient(closest-side, rgb(232 221 200 / 0.95), rgb(232 221 200 / 0.35) 60%, transparent 72%)" }}
      />

      {/* Full-width mountain range + dashed travel route, anchored to the bottom */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[42vh] min-h-56 w-full"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        {/* Far ridge (teal) */}
        <path
          d="M0 320 L170 215 L300 290 L470 160 L620 265 L790 150 L960 268 L1120 190 L1290 285 L1440 210 L1440 420 L0 420 Z"
          fill="#176B5B"
          fillOpacity="0.1"
        />
        {/* Near ridge (deeper teal) */}
        <path
          d="M0 392 L140 300 L330 362 L520 252 L710 352 L900 262 L1080 356 L1260 292 L1440 350 L1440 420 L0 420 Z"
          fill="#176B5B"
          fillOpacity="0.16"
        />
        {/* Foreground dune (sand) */}
        <path
          d="M0 420 C 240 372, 480 400, 720 386 C 960 372, 1200 398, 1440 378 L1440 420 Z"
          fill="#C9B88F"
          fillOpacity="0.5"
        />
        {/* Dashed route flying over the range */}
        <path
          d="M-20 330 C 220 240, 420 330, 640 230 S 1080 130, 1460 170"
          stroke="#176B5B"
          strokeOpacity="0.4"
          strokeWidth="2.5"
          strokeDasharray="1 11"
          strokeLinecap="round"
        />
        {/* Waypoints along the route */}
        <circle cx="222" cy="277" r="5.5" fill="#176B5B" fillOpacity="0.45" />
        <circle cx="640" cy="230" r="5.5" fill="#176B5B" fillOpacity="0.45" />
        <circle cx="1056" cy="152" r="5.5" fill="#176B5B" fillOpacity="0.45" />
        {/* Paper plane at the route's end */}
        <g transform="translate(1180 142) rotate(-8)" fill="#176B5B" fillOpacity="0.5">
          <path d="M0 10 L34 0 L12 22 L11 13 Z" />
        </g>
      </svg>
    </div>
  );
}
