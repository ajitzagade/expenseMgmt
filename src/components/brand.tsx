import { BRAND } from "@/lib/brand";

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill={BRAND.primary} />
      {/* split-share arc, tucked in the corner */}
      <path d="M 20.8 3.8 A 7.5 7.5 0 0 1 28.2 11.2" stroke={BRAND.accent} strokeOpacity="0.4" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      {/* the rupee, front and center */}
      <text
        x="15.6"
        y="25.2"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        fontWeight={700}
        fontSize={24}
        fill={BRAND.accent}
        textAnchor="middle"
      >
        ₹
      </text>
    </svg>
  );
}
