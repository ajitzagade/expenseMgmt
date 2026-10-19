import { assertMinorUnits } from "./money";

/**
 * Balance engine.
 *
 * Net balance (before settlements) = total paid toward expenses − total allocated.
 *   positive  -> participant should receive money
 *   negative  -> participant owes money
 *
 * Confirmed settlement payments adjust the OUTSTANDING balance without
 * touching the underlying expense record:
 *   outstanding = net + settlementsPaid − settlementsReceived
 * (paying a settlement moves a debtor's negative outstanding toward zero).
 */

export interface BalanceInputs {
  participantIds: string[];
  /** One row per (expense, payer): participant contribution toward an expense. */
  contributions: { participantId: string; amountMinor: number }[];
  /** One row per (expense, sharer): participant's allocated share of an expense. */
  allocations: { participantId: string; amountMinor: number }[];
  /** Confirmed settlement payments between participants. */
  settlements: { fromParticipantId: string; toParticipantId: string; amountMinor: number }[];
}

export interface ParticipantBalance {
  participantId: string;
  paidMinor: number;
  allocatedMinor: number;
  settlementsPaidMinor: number;
  settlementsReceivedMinor: number;
  /** paid − allocated (before settlements). */
  netMinor: number;
  /** net adjusted for confirmed settlements. */
  outstandingMinor: number;
}

export function computeBalances(inputs: BalanceInputs): Map<string, ParticipantBalance> {
  const balances = new Map<string, ParticipantBalance>();
  for (const id of inputs.participantIds) {
    balances.set(id, {
      participantId: id,
      paidMinor: 0,
      allocatedMinor: 0,
      settlementsPaidMinor: 0,
      settlementsReceivedMinor: 0,
      netMinor: 0,
      outstandingMinor: 0,
    });
  }
  const get = (id: string): ParticipantBalance => {
    const b = balances.get(id);
    if (!b) throw new Error(`Unknown participant in financial records: ${id}`);
    return b;
  };
  for (const c of inputs.contributions) {
    assertMinorUnits(c.amountMinor);
    get(c.participantId).paidMinor += c.amountMinor;
  }
  for (const a of inputs.allocations) {
    assertMinorUnits(a.amountMinor);
    get(a.participantId).allocatedMinor += a.amountMinor;
  }
  for (const s of inputs.settlements) {
    assertMinorUnits(s.amountMinor);
    get(s.fromParticipantId).settlementsPaidMinor += s.amountMinor;
    get(s.toParticipantId).settlementsReceivedMinor += s.amountMinor;
  }
  for (const b of balances.values()) {
    b.netMinor = b.paidMinor - b.allocatedMinor;
    b.outstandingMinor = b.netMinor + b.settlementsPaidMinor - b.settlementsReceivedMinor;
  }
  return balances;
}

/**
 * Sum of all outstanding balances for a trip. Must be zero whenever the
 * underlying records are consistent — used as a reconciliation check.
 */
export function reconciliationTotal(balances: Iterable<ParticipantBalance>): number {
  let total = 0;
  for (const b of balances) total += b.outstandingMinor;
  return total;
}

export type BalanceStatus = "settled" | "owed" | "owes";

export function balanceStatus(outstandingMinor: number): BalanceStatus {
  if (outstandingMinor > 0) return "owed";
  if (outstandingMinor < 0) return "owes";
  return "settled";
}
