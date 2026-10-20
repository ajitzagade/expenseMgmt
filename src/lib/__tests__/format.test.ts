import { describe, expect, it } from "vitest";
import { formatDate, minorToInput } from "../format";

describe("formatDate", () => {
  it("renders date-only values in UTC so the calendar date never shifts", () => {
    // Regardless of the machine's timezone, a @db.Date value (UTC midnight)
    // must render as the stored calendar date.
    expect(formatDate("2026-10-19")).toContain("19");
    expect(formatDate(new Date("2026-10-19T00:00:00.000Z"))).toContain("19");
  });

  it("renders real timestamps without forcing UTC", () => {
    const stamp = new Date("2026-10-19T12:30:00.000Z");
    expect(formatDate(stamp)).toBe(
      stamp.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    );
  });

  it("handles null and undefined", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("minorToInput", () => {
  it("round-trips whole and fractional amounts", () => {
    expect(minorToInput(125050)).toBe("1250.50");
    expect(minorToInput(125000)).toBe("1250");
    expect(minorToInput(-5005)).toBe("-50.05");
  });
});
