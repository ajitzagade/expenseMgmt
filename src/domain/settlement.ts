import type { ParticipantBalance } from "./balance";

/**
 * Settlement engine.
 *
 * Produces a deterministic list of suggested transfers (debtor -> creditor)
 * that bring every outstanding balance to zero.
 *
 * Algorithm: greedy largest-debtor-to-largest-creditor matching.
 *  - Sort creditors by outstanding desc, debtors by debt desc
 *    (ties broken by participantId so output is deterministic).
 *  - Repeatedly transfer min(debt, credit) between the current heads.
 *
 * Complexity O(n log n); produces at most (debtors + creditors − 1)
 * transfers, which is optimal for the greedy family and near-minimal in
 * practice. A globally minimal transfer count is NP-hard (subset-sum
 * matching) and deliberately not attempted — correctness and determinism
 * take priority (see docs/ARCHITECTURE.md).
 *
 * Suggested transfers are recommendations only; the app never moves money.
 */

export interface SuggestedTransfer {
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
}

export function suggestSettlements(balances: Iterable<ParticipantBalance>): SuggestedTransfer[] {
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];
  let sum = 0;
  for (const b of balances) {
    sum += b.outstandingMinor;
    if (b.outstandingMinor > 0) creditors.push({ id: b.participantId, amount: b.outstandingMinor });
    else if (b.outstandingMinor < 0) debtors.push({ id: b.participantId, amount: -b.outstandingMinor });
  }
  if (sum !== 0) {
    throw new Error(`Cannot settle: outstanding balances do not reconcile to zero (off by ${sum} minor units)`);
  }
  const byAmountDescThenId = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  creditors.sort(byAmountDescThenId);
  debtors.sort(byAmountDescThenId);

  const transfers: SuggestedTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);
    transfers.push({ fromParticipantId: debtor.id, toParticipantId: creditor.id, amountMinor: amount });
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }
  return transfers;
}
