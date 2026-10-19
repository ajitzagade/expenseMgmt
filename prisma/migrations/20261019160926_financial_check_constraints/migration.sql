-- Database-level financial invariants (defense in depth; the service layer
-- validates the same rules before writing).

-- An expense amount is always positive.
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amountMinor_positive" CHECK ("amountMinor" > 0);

-- A payer contribution is always positive.
ALTER TABLE "ExpensePayerContribution"
  ADD CONSTRAINT "ExpensePayerContribution_amountMinor_positive" CHECK ("amountMinor" > 0);

-- An allocation can be zero (explicit zero share) but never negative.
ALTER TABLE "ExpenseAllocation"
  ADD CONSTRAINT "ExpenseAllocation_amountMinor_nonnegative" CHECK ("amountMinor" >= 0);

-- A settlement payment is always positive and never pays yourself.
ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_amountMinor_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_distinct_parties" CHECK ("fromParticipantId" <> "toParticipantId");
