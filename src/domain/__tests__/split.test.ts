import { describe, expect, it } from "vitest";
import { DomainError } from "../money";
import { computeSplit, distributeProportionally, validatePayerContributions } from "../split";

const total = (allocs: { amountMinor: number }[]) => allocs.reduce((a, x) => a + x.amountMinor, 0);

describe("EQUAL split", () => {
  it("splits evenly when divisible", () => {
    const allocs = computeSplit({
      method: "EQUAL",
      amountMinor: 120000,
      participants: [{ participantId: "ajit" }, { participantId: "rahul" }],
    });
    expect(allocs).toEqual([
      { participantId: "ajit", amountMinor: 60000 },
      { participantId: "rahul", amountMinor: 60000 },
    ]);
  });

  it("distributes the remainder deterministically: ₹100 / 3 = 33.34, 33.33, 33.33", () => {
    const allocs = computeSplit({
      method: "EQUAL",
      amountMinor: 10000,
      participants: [{ participantId: "a" }, { participantId: "b" }, { participantId: "c" }],
    });
    expect(allocs.map((a) => a.amountMinor)).toEqual([3334, 3333, 3333]);
    expect(total(allocs)).toBe(10000);
  });

  it("never loses or invents money across many awkward amounts", () => {
    for (let amount = 1; amount <= 1000; amount++) {
      for (const n of [1, 2, 3, 4, 5, 6, 7, 11]) {
        const allocs = computeSplit({
          method: "EQUAL",
          amountMinor: amount,
          participants: Array.from({ length: n }, (_, i) => ({ participantId: `p${i}` })),
        });
        expect(total(allocs)).toBe(amount);
        const amounts = allocs.map((a) => a.amountMinor);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("supports a single participant", () => {
    const allocs = computeSplit({ method: "EQUAL", amountMinor: 999, participants: [{ participantId: "solo" }] });
    expect(allocs).toEqual([{ participantId: "solo", amountMinor: 999 }]);
  });
});

describe("EXACT split", () => {
  it("accepts allocations that sum exactly", () => {
    const allocs = computeSplit({
      method: "EXACT",
      amountMinor: 200000,
      participants: [
        { participantId: "ajit", exactMinor: 80000 },
        { participantId: "rahul", exactMinor: 70000 },
        { participantId: "amit", exactMinor: 50000 },
      ],
    });
    expect(total(allocs)).toBe(200000);
  });

  it("rejects totals that do not reconcile", () => {
    expect(() =>
      computeSplit({
        method: "EXACT",
        amountMinor: 200000,
        participants: [
          { participantId: "ajit", exactMinor: 80000 },
          { participantId: "rahul", exactMinor: 70000 },
        ],
      }),
    ).toThrowError(/add up to the expense total/);
  });

  it("allows an explicit zero share but not negatives", () => {
    const allocs = computeSplit({
      method: "EXACT",
      amountMinor: 100,
      participants: [
        { participantId: "a", exactMinor: 100 },
        { participantId: "b", exactMinor: 0 },
      ],
    });
    expect(allocs[1].amountMinor).toBe(0);
    expect(() =>
      computeSplit({
        method: "EXACT",
        amountMinor: 100,
        participants: [
          { participantId: "a", exactMinor: 200 },
          { participantId: "b", exactMinor: -100 },
        ],
      }),
    ).toThrow(DomainError);
  });
});

describe("PERCENTAGE split", () => {
  it("allocates 50/30/20 of ₹1000 exactly", () => {
    const allocs = computeSplit({
      method: "PERCENTAGE",
      amountMinor: 100000,
      participants: [
        { participantId: "ajit", percentBps: 5000 },
        { participantId: "rahul", percentBps: 3000 },
        { participantId: "sneha", percentBps: 2000 },
      ],
    });
    expect(allocs.map((a) => a.amountMinor)).toEqual([50000, 30000, 20000]);
  });

  it("reconciles rounding to the exact total (33.33% x 3 of ₹1)", () => {
    const allocs = computeSplit({
      method: "PERCENTAGE",
      amountMinor: 100,
      participants: [
        { participantId: "a", percentBps: 3334 },
        { participantId: "b", percentBps: 3333 },
        { participantId: "c", percentBps: 3333 },
      ],
    });
    expect(total(allocs)).toBe(100);
  });

  it("rejects percentages that do not total 100%", () => {
    expect(() =>
      computeSplit({
        method: "PERCENTAGE",
        amountMinor: 100000,
        participants: [
          { participantId: "a", percentBps: 5000 },
          { participantId: "b", percentBps: 4000 },
        ],
      }),
    ).toThrowError(/100%/);
  });
});

describe("SHARES split", () => {
  it("allocates ₹1000 as 2:1:1", () => {
    const allocs = computeSplit({
      method: "SHARES",
      amountMinor: 100000,
      participants: [
        { participantId: "ajit", shares: 2 },
        { participantId: "rahul", shares: 1 },
        { participantId: "amit", shares: 1 },
      ],
    });
    expect(allocs.map((a) => a.amountMinor)).toEqual([50000, 25000, 25000]);
  });

  it("reconciles rounding for awkward weights", () => {
    const allocs = computeSplit({
      method: "SHARES",
      amountMinor: 1000,
      participants: [
        { participantId: "a", shares: 3 },
        { participantId: "b", shares: 3 },
        { participantId: "c", shares: 1 },
      ],
    });
    expect(total(allocs)).toBe(1000);
  });

  it("rejects zero or fractional shares", () => {
    for (const shares of [0, -1, 1.5]) {
      expect(() =>
        computeSplit({
          method: "SHARES",
          amountMinor: 100,
          participants: [{ participantId: "a", shares }],
        }),
      ).toThrow(DomainError);
    }
  });
});

describe("validation shared by all methods", () => {
  it("rejects empty participant lists, duplicates, and non-positive amounts", () => {
    expect(() => computeSplit({ method: "EQUAL", amountMinor: 100, participants: [] })).toThrow(DomainError);
    expect(() =>
      computeSplit({
        method: "EQUAL",
        amountMinor: 100,
        participants: [{ participantId: "a" }, { participantId: "a" }],
      }),
    ).toThrow(DomainError);
    for (const amount of [0, -100, 10.5]) {
      expect(() => computeSplit({ method: "EQUAL", amountMinor: amount, participants: [{ participantId: "a" }] })).toThrow(
        DomainError,
      );
    }
  });
});

describe("distributeProportionally", () => {
  it("handles very large amounts without overflow", () => {
    const amounts = distributeProportionally(9_007_199_254_740, [1, 1, 1]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(9_007_199_254_740);
  });
});

describe("validatePayerContributions (multiple payers)", () => {
  it("accepts contributions that sum to the total", () => {
    expect(() =>
      validatePayerContributions(1000000, [
        { participantId: "ajit", amountMinor: 600000 },
        { participantId: "rahul", amountMinor: 400000 },
      ]),
    ).not.toThrow();
  });

  it("rejects mismatched totals, duplicates, empty and non-positive contributions", () => {
    expect(() => validatePayerContributions(1000000, [{ participantId: "ajit", amountMinor: 600000 }])).toThrowError(
      /add up to the expense total/,
    );
    expect(() =>
      validatePayerContributions(1000, [
        { participantId: "a", amountMinor: 500 },
        { participantId: "a", amountMinor: 500 },
      ]),
    ).toThrow(DomainError);
    expect(() => validatePayerContributions(1000, [])).toThrow(DomainError);
    expect(() =>
      validatePayerContributions(1000, [
        { participantId: "a", amountMinor: 1000 },
        { participantId: "b", amountMinor: 0 },
      ]),
    ).toThrow(DomainError);
  });
});
