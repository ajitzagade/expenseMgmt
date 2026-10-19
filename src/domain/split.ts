import { DomainError, assertMinorUnits, assertPositiveMinorUnits, sumMinor } from "./money";

/**
 * Split engine.
 *
 * Every expense has its own split configuration. The engine converts a split
 * specification into exact per-participant allocations in minor units, with
 * the hard invariant that allocations always sum to the expense total.
 *
 * Remainder distribution is deterministic:
 *  - Proportional methods (EQUAL, PERCENTAGE, SHARES) floor each raw share,
 *    then hand out the remaining minor units one at a time, ordered by
 *    largest fractional remainder first, ties broken by input order.
 *    e.g. 10000 (₹100.00) split equally 3 ways -> 3334, 3333, 3333.
 *  - EXACT and CUSTOM must already sum to the total; nothing is adjusted.
 */

export const SPLIT_METHODS = ["EQUAL", "EXACT", "PERCENTAGE", "SHARES", "CUSTOM"] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export interface SplitParticipantInput {
  /** Stable participant id (never a display name). */
  participantId: string;
  /** EXACT / CUSTOM: amount owed in minor units. */
  exactMinor?: number;
  /** PERCENTAGE: share in basis points (1% = 100 bps). Must total 10000. */
  percentBps?: number;
  /** SHARES: positive integer weight. */
  shares?: number;
}

export interface SplitInput {
  method: SplitMethod;
  amountMinor: number;
  participants: SplitParticipantInput[];
}

export interface Allocation {
  participantId: string;
  amountMinor: number;
}

function assertDistinctParticipants(participants: SplitParticipantInput[]): void {
  if (participants.length === 0) {
    throw new DomainError("NO_PARTICIPANTS", "Select at least one participant to share this expense");
  }
  const ids = new Set(participants.map((p) => p.participantId));
  if (ids.size !== participants.length) {
    throw new DomainError("DUPLICATE_PARTICIPANT", "A participant appears more than once in the split");
  }
}

/**
 * Distributes `amountMinor` proportionally to integer `weights`, flooring each
 * share and assigning leftover minor units by largest remainder (ties by
 * input order). Total of the result always equals `amountMinor` exactly.
 */
export function distributeProportionally(amountMinor: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    throw new DomainError("INVALID_SPLIT", "Split weights must be greater than zero in total");
  }
  // Use BigInt for the intermediate product so large amounts cannot overflow.
  const amount = BigInt(amountMinor);
  const total = BigInt(totalWeight);
  const base: number[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  for (let i = 0; i < weights.length; i++) {
    const product = amount * BigInt(weights[i]);
    base.push(Number(product / total));
    remainders.push({ index: i, remainder: product % total });
  }
  let leftover = amountMinor - base.reduce((a, b) => a + b, 0);
  // Stable sort: largest fractional remainder first; ties keep input order.
  remainders.sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));
  for (const r of remainders) {
    if (leftover <= 0) break;
    base[r.index] += 1;
    leftover -= 1;
  }
  return base;
}

/** Computes exact allocations for a split. Throws DomainError on invalid input. */
export function computeSplit(input: SplitInput): Allocation[] {
  assertPositiveMinorUnits(input.amountMinor, "expense amount");
  assertDistinctParticipants(input.participants);
  const { method, amountMinor, participants } = input;

  switch (method) {
    case "EQUAL": {
      const amounts = distributeProportionally(
        amountMinor,
        participants.map(() => 1),
      );
      return participants.map((p, i) => ({ participantId: p.participantId, amountMinor: amounts[i] }));
    }

    case "EXACT":
    case "CUSTOM": {
      for (const p of participants) {
        if (p.exactMinor === undefined) {
          throw new DomainError("INVALID_SPLIT", "Every participant needs an amount for this split method");
        }
        assertMinorUnits(p.exactMinor, "participant amount");
        if (p.exactMinor < 0) {
          throw new DomainError("INVALID_SPLIT", "Participant amounts cannot be negative");
        }
      }
      const total = sumMinor(participants.map((p) => p.exactMinor as number));
      if (total !== amountMinor) {
        throw new DomainError(
          "SPLIT_TOTAL_MISMATCH",
          `Participant amounts must add up to the expense total exactly (got ${total}, expected ${amountMinor})`,
        );
      }
      return participants.map((p) => ({ participantId: p.participantId, amountMinor: p.exactMinor as number }));
    }

    case "PERCENTAGE": {
      for (const p of participants) {
        if (p.percentBps === undefined || !Number.isSafeInteger(p.percentBps) || p.percentBps < 0) {
          throw new DomainError("INVALID_SPLIT", "Every participant needs a valid percentage");
        }
      }
      const totalBps = participants.reduce((a, p) => a + (p.percentBps as number), 0);
      if (totalBps !== 10_000) {
        throw new DomainError("SPLIT_TOTAL_MISMATCH", `Percentages must add up to exactly 100% (got ${totalBps / 100}%)`);
      }
      const amounts = distributeProportionally(
        amountMinor,
        participants.map((p) => p.percentBps as number),
      );
      return participants.map((p, i) => ({ participantId: p.participantId, amountMinor: amounts[i] }));
    }

    case "SHARES": {
      for (const p of participants) {
        if (p.shares === undefined || !Number.isSafeInteger(p.shares) || p.shares <= 0) {
          throw new DomainError("INVALID_SPLIT", "Every participant needs a whole number of shares (at least 1)");
        }
      }
      const amounts = distributeProportionally(
        amountMinor,
        participants.map((p) => p.shares as number),
      );
      return participants.map((p, i) => ({ participantId: p.participantId, amountMinor: amounts[i] }));
    }

    default: {
      const exhaustive: never = method;
      throw new DomainError("INVALID_SPLIT", `Unknown split method ${exhaustive}`);
    }
  }
}

export interface PayerContributionInput {
  participantId: string;
  amountMinor: number;
}

/**
 * Validates multi-payer contributions: each positive, no duplicate payers,
 * and the contributions sum exactly to the expense total.
 */
export function validatePayerContributions(amountMinor: number, payers: PayerContributionInput[]): void {
  assertPositiveMinorUnits(amountMinor, "expense amount");
  if (payers.length === 0) {
    throw new DomainError("NO_PAYERS", "Select who paid this expense");
  }
  const ids = new Set(payers.map((p) => p.participantId));
  if (ids.size !== payers.length) {
    throw new DomainError("DUPLICATE_PAYER", "A payer appears more than once");
  }
  for (const p of payers) {
    assertPositiveMinorUnits(p.amountMinor, "payer contribution");
  }
  const total = sumMinor(payers.map((p) => p.amountMinor));
  if (total !== amountMinor) {
    throw new DomainError(
      "PAYER_TOTAL_MISMATCH",
      `Payer contributions must add up to the expense total exactly (got ${total}, expected ${amountMinor})`,
    );
  }
}
