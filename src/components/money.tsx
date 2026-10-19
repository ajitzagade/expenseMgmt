import { formatMinor, type CurrencyCode } from "@/domain/money";

/**
 * Financial figure with tabular numerals. With `signed`, color and an explicit
 * +/− communicate direction — never color alone (the sign carries the meaning
 * for color-blind users and monochrome prints).
 */
export function Money({
  minor,
  currency,
  signed = false,
  className = "",
}: {
  minor: number;
  currency: CurrencyCode;
  signed?: boolean;
  className?: string;
}) {
  const color = !signed ? "" : minor > 0 ? "text-positive" : minor < 0 ? "text-negative" : "text-ink-soft";
  return <span className={`tnum ${color} ${className}`}>{formatMinor(minor, currency, { sign: signed })}</span>;
}
