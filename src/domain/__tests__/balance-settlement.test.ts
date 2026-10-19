import { describe, expect, it } from "vitest";
import { balanceStatus, computeBalances, reconciliationTotal, type BalanceInputs } from "../balance";
import { suggestSettlements } from "../settlement";
import { computeSplit } from "../split";

/**
 * The reference scenario from the product requirements: the "Goa Weekend
 * Trip" with Ajit, Rahul, Amit and Sneha. All amounts in paise.
 */
function goaScenario(): BalanceInputs {
  const [AJIT, RAHUL, AMIT, SNEHA] = ["ajit", "rahul", "amit", "sneha"];
  const everyone = [AJIT, RAHUL, AMIT, SNEHA];

  const expenses = [
    // Hotel ₹8,000 paid by Ajit, shared by all four.
    { amount: 800000, payers: [{ participantId: AJIT, amountMinor: 800000 }], sharers: everyone },
    // Dinner ₹2,400 paid by Rahul, shared by all four.
    { amount: 240000, payers: [{ participantId: RAHUL, amountMinor: 240000 }], sharers: everyone },
    // Drinks ₹1,200 paid by Amit, shared only by Ajit and Amit.
    { amount: 120000, payers: [{ participantId: AMIT, amountMinor: 120000 }], sharers: [AJIT, AMIT] },
    // Taxi ₹800 paid by Sneha, shared only by Rahul and Sneha.
    { amount: 80000, payers: [{ participantId: SNEHA, amountMinor: 80000 }], sharers: [RAHUL, SNEHA] },
    // Breakfast ₹600 paid by Ajit, shared by Ajit, Rahul and Sneha.
    { amount: 60000, payers: [{ participantId: AJIT, amountMinor: 60000 }], sharers: [AJIT, RAHUL, SNEHA] },
  ];

  const contributions: BalanceInputs["contributions"] = [];
  const allocations: BalanceInputs["allocations"] = [];
  for (const e of expenses) {
    contributions.push(...e.payers.map((p) => ({ participantId: p.participantId, amountMinor: p.amountMinor })));
    allocations.push(
      ...computeSplit({
        method: "EQUAL",
        amountMinor: e.amount,
        participants: e.sharers.map((participantId) => ({ participantId })),
      }),
    );
  }
  return { participantIds: everyone, contributions, allocations, settlements: [] };
}

describe("Goa Weekend Trip scenario", () => {
  it("computes paid, allocated and net balances correctly", () => {
    const balances = computeBalances(goaScenario());

    expect(balances.get("ajit")).toMatchObject({ paidMinor: 860000, allocatedMinor: 340000, netMinor: 520000 });
    expect(balances.get("rahul")).toMatchObject({ paidMinor: 240000, allocatedMinor: 320000, netMinor: -80000 });
    expect(balances.get("amit")).toMatchObject({ paidMinor: 120000, allocatedMinor: 320000, netMinor: -200000 });
    expect(balances.get("sneha")).toMatchObject({ paidMinor: 80000, allocatedMinor: 320000, netMinor: -240000 });

    // Drinks were shared only by Ajit and Amit: Rahul and Sneha carry none of it.
    // (Their allocation of 320000 = hotel 200000 + dinner 60000 + taxi 40000 + breakfast 20000.)
    expect(reconciliationTotal(balances.values())).toBe(0);
  });

  it("suggests deterministic transfers that settle the trip", () => {
    const balances = computeBalances(goaScenario());
    const transfers = suggestSettlements(balances.values());
    expect(transfers).toEqual([
      { fromParticipantId: "sneha", toParticipantId: "ajit", amountMinor: 240000 },
      { fromParticipantId: "amit", toParticipantId: "ajit", amountMinor: 200000 },
      { fromParticipantId: "rahul", toParticipantId: "ajit", amountMinor: 80000 },
    ]);
    // Applying the transfers settles everyone.
    const settled = computeBalances({
      ...goaScenario(),
      settlements: transfers.map((t) => ({
        fromParticipantId: t.fromParticipantId,
        toParticipantId: t.toParticipantId,
        amountMinor: t.amountMinor,
      })),
    });
    for (const b of settled.values()) {
      expect(b.outstandingMinor).toBe(0);
      expect(balanceStatus(b.outstandingMinor)).toBe("settled");
    }
  });

  it("handles partial settlements: outstanding shrinks, net is unchanged", () => {
    const scenario = goaScenario();
    scenario.settlements = [{ fromParticipantId: "amit", toParticipantId: "ajit", amountMinor: 100000 }];
    const balances = computeBalances(scenario);
    expect(balances.get("amit")).toMatchObject({ netMinor: -200000, outstandingMinor: -100000 });
    expect(balances.get("ajit")).toMatchObject({ netMinor: 520000, outstandingMinor: 420000 });
    expect(reconciliationTotal(balances.values())).toBe(0);
  });
});

describe("settlement engine (spec example)", () => {
  it("matches the documented example: +1500, +500, −1200, −800", () => {
    const transfers = suggestSettlements([
      bal("ajit", 150000),
      bal("rahul", 50000),
      bal("amit", -120000),
      bal("sneha", -80000),
    ]);
    expect(transfers).toEqual([
      { fromParticipantId: "amit", toParticipantId: "ajit", amountMinor: 120000 },
      { fromParticipantId: "sneha", toParticipantId: "ajit", amountMinor: 30000 },
      { fromParticipantId: "sneha", toParticipantId: "rahul", amountMinor: 50000 },
    ]);
  });

  it("returns no transfers when everyone is settled", () => {
    expect(suggestSettlements([bal("a", 0), bal("b", 0)])).toEqual([]);
  });

  it("is deterministic under ties (breaks by participant id)", () => {
    const t1 = suggestSettlements([bal("b", 100), bal("a", 100), bal("d", -100), bal("c", -100)]);
    const t2 = suggestSettlements([bal("a", 100), bal("c", -100), bal("b", 100), bal("d", -100)]);
    expect(t1).toEqual(t2);
    expect(t1).toEqual([
      { fromParticipantId: "c", toParticipantId: "a", amountMinor: 100 },
      { fromParticipantId: "d", toParticipantId: "b", amountMinor: 100 },
    ]);
  });

  it("rejects balances that do not reconcile to zero", () => {
    expect(() => suggestSettlements([bal("a", 100)])).toThrowError(/reconcile/);
  });

  it("settles a single minor unit correctly (rounding edge)", () => {
    const transfers = suggestSettlements([bal("a", 1), bal("b", -1)]);
    expect(transfers).toEqual([{ fromParticipantId: "b", toParticipantId: "a", amountMinor: 1 }]);
  });
});

describe("balance edge cases", () => {
  it("a payer excluded from the allocation is purely a creditor", () => {
    // Ajit pays ₹1,000 for a bill shared only by Rahul and Sneha.
    const balances = computeBalances({
      participantIds: ["ajit", "rahul", "sneha"],
      contributions: [{ participantId: "ajit", amountMinor: 100000 }],
      allocations: computeSplit({
        method: "EQUAL",
        amountMinor: 100000,
        participants: [{ participantId: "rahul" }, { participantId: "sneha" }],
      }),
      settlements: [],
    });
    expect(balances.get("ajit")).toMatchObject({ paidMinor: 100000, allocatedMinor: 0, netMinor: 100000 });
    expect(balances.get("rahul")).toMatchObject({ paidMinor: 0, allocatedMinor: 50000, netMinor: -50000 });
    expect(reconciliationTotal(balances.values())).toBe(0);
  });

  it("a participant with no records has a zero, settled balance", () => {
    const balances = computeBalances({ participantIds: ["idle"], contributions: [], allocations: [], settlements: [] });
    expect(balances.get("idle")).toMatchObject({ netMinor: 0, outstandingMinor: 0 });
    expect(balanceStatus(0)).toBe("settled");
  });

  it("rejects financial rows for unknown participants", () => {
    expect(() =>
      computeBalances({
        participantIds: ["a"],
        contributions: [{ participantId: "ghost", amountMinor: 100 }],
        allocations: [],
        settlements: [],
      }),
    ).toThrowError(/Unknown participant/);
  });
});

function bal(participantId: string, outstandingMinor: number) {
  return {
    participantId,
    paidMinor: 0,
    allocatedMinor: 0,
    settlementsPaidMinor: 0,
    settlementsReceivedMinor: 0,
    netMinor: outstandingMinor,
    outstandingMinor,
  };
}
