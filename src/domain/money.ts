/**
 * Money is always handled as integer minor units (e.g. paise for INR).
 * Binary floating point is never used as the authoritative representation.
 */

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Currencies supported by the app. All use 2 decimal places (exponent 2). */
export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_INFO: Record<CurrencyCode, { symbol: string; name: string; minorPerMajor: number }> = {
  INR: { symbol: "₹", name: "Indian Rupee", minorPerMajor: 100 },
  USD: { symbol: "$", name: "US Dollar", minorPerMajor: 100 },
  EUR: { symbol: "€", name: "Euro", minorPerMajor: 100 },
  GBP: { symbol: "£", name: "British Pound", minorPerMajor: 100 },
  AED: { symbol: "د.إ", name: "UAE Dirham", minorPerMajor: 100 },
  SGD: { symbol: "S$", name: "Singapore Dollar", minorPerMajor: 100 },
};

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

/** Asserts a value is a usable integer amount of minor units. */
export function assertMinorUnits(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new DomainError("INVALID_AMOUNT", `${label} must be an integer number of minor units`);
  }
}

export function assertPositiveMinorUnits(value: number, label = "amount"): void {
  assertMinorUnits(value, label);
  if (value <= 0) {
    throw new DomainError("INVALID_AMOUNT", `${label} must be greater than zero`);
  }
}

/**
 * Parses a user-entered decimal string (e.g. "1234.5") into minor units
 * without going through binary floating point.
 */
export function parseAmountToMinor(input: string, currency: CurrencyCode): number {
  const trimmed = input.trim();
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new DomainError("INVALID_AMOUNT", "Enter a valid amount, e.g. 1250 or 1250.50");
  }
  const whole = match[1];
  const frac = (match[2] ?? "").padEnd(2, "0");
  const minorPerMajor = CURRENCY_INFO[currency].minorPerMajor;
  const minor = parseInt(whole, 10) * minorPerMajor + parseInt(frac || "0", 10);
  assertMinorUnits(minor);
  return minor;
}

/** Formats minor units for display, e.g. 123450 INR -> "₹1,234.50". */
export function formatMinor(minor: number, currency: CurrencyCode, options?: { sign?: boolean }): string {
  assertMinorUnits(minor);
  const { symbol, minorPerMajor } = CURRENCY_INFO[currency];
  const abs = Math.abs(minor);
  const major = Math.floor(abs / minorPerMajor);
  const frac = String(abs % minorPerMajor).padStart(2, "0");
  const grouped = major.toLocaleString(currency === "INR" ? "en-IN" : "en-US");
  const sign = minor < 0 ? "−" : options?.sign && minor > 0 ? "+" : "";
  return `${sign}${symbol}${grouped}.${frac}`;
}

export function sumMinor(values: number[]): number {
  let total = 0;
  for (const v of values) {
    assertMinorUnits(v);
    total += v;
    assertMinorUnits(total, "total");
  }
  return total;
}
