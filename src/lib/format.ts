import { CURRENCY_INFO, formatMinor, type CurrencyCode } from "@/domain/money";

export { formatMinor, CURRENCY_INFO };
export type { CurrencyCode };

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatDateRange(start: string | Date | null, end: string | Date | null): string {
  if (!start && !end) return "Dates not set";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `From ${formatDate(start)}` : `Until ${formatDate(end)}`;
}

/** Converts minor units to a decimal string for form inputs, e.g. 125050 -> "1250.50". */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const frac = abs % 100;
  return frac === 0 ? `${sign}${Math.floor(abs / 100)}` : `${sign}${Math.floor(abs / 100)}.${String(frac).padStart(2, "0")}`;
}

export const TRIP_COLORS = [
  "#176B5B", // teal
  "#8A7A58", // sand
  "#4A6FA5", // slate blue
  "#B5473C", // terracotta
  "#6B5B95", // plum
  "#2E7D6B", // sea green
  "#A3623B", // clay
  "#54707A", // storm
] as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
