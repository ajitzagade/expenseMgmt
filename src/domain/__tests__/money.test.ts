import { describe, expect, it } from "vitest";
import { DomainError, formatMinor, parseAmountToMinor, sumMinor } from "../money";

describe("parseAmountToMinor", () => {
  it("parses whole and decimal amounts without float error", () => {
    expect(parseAmountToMinor("1250", "INR")).toBe(125000);
    expect(parseAmountToMinor("1250.5", "INR")).toBe(125050);
    expect(parseAmountToMinor("0.01", "INR")).toBe(1);
    expect(parseAmountToMinor("19.99", "USD")).toBe(1999);
    // classic float trap: 0.1 + 0.2
    expect(parseAmountToMinor("0.30", "INR")).toBe(30);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "-5", "1.234", "1,000", "abc", "1.2.3", ".5"]) {
      expect(() => parseAmountToMinor(bad, "INR"), bad).toThrow(DomainError);
    }
  });
});

describe("formatMinor", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatMinor(123450, "INR")).toBe("₹1,234.50");
    expect(formatMinor(10000000, "INR")).toBe("₹1,00,000.00");
  });
  it("formats negatives and signed positives", () => {
    expect(formatMinor(-5000, "INR")).toBe("−₹50.00");
    expect(formatMinor(5000, "INR", { sign: true })).toBe("+₹50.00");
    expect(formatMinor(0, "INR")).toBe("₹0.00");
  });
});

describe("sumMinor", () => {
  it("sums and validates integers", () => {
    expect(sumMinor([1, 2, 3])).toBe(6);
    expect(() => sumMinor([1.5])).toThrow(DomainError);
  });
});
