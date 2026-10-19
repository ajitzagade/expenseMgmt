export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#176B5B" />
      <path d="M9 20.5 16 9l7 11.5" stroke="#E8DDC8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="22.5" r="1.8" fill="#E8DDC8" />
    </svg>
  );
}
