export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#176B5B" />
      {/* Coin ring with a share pulled out (the TripSplit mark) */}
      <path d="M 24.2 15.1 A 9.4 9.4 0 1 1 17 7.8" stroke="#E8DDC8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 15 17 L 17 7.8 A 9.4 9.4 0 0 1 24.2 15.1 Z" fill="#E8DDC8" transform="translate(2.3 -2.3)" />
      <path d="M 12.4 15.7 h4.2 M 12.4 18.3 h4.2 M 13 15.7 l 2.7 4.9" stroke="#E8DDC8" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
