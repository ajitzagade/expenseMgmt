# TripSplit Architecture

## Overview

A **modular monolith** on Next.js (App Router). One deployable, strict internal layering:

```
┌─────────────────────────────────────────────────────────┐
│  Presentation                                           │
│  src/app/**            server components (reads)        │
│                        client components (forms/actions)│
├─────────────────────────────────────────────────────────┤
│  API                   src/app/api/**  REST route       │
│                        handlers: zod parsing, authn,    │
│                        error mapping (src/server/api.ts)│
├─────────────────────────────────────────────────────────┤
│  Application services  src/server/services/*            │
│                        authorization, transactions,     │
│                        activity log                     │
├─────────────────────────────────────────────────────────┤
│  Domain (pure)         src/domain/*                     │
│                        money, split, balance, settlement│
│                        — no framework, no I/O           │
├─────────────────────────────────────────────────────────┤
│  Infrastructure        Prisma 7 + PostgreSQL            │
│                        (src/lib/db.ts, prisma/schema)   │
└─────────────────────────────────────────────────────────┘
```

Why a monolith: one small team, one database, interactive latency requirements, no scale driver for services. The domain layer is dependency-free, so core financial rules are portable (they also run in the browser for instant split previews — the server always recomputes authoritatively).

### SOLID mapping

- **S** — one service per concern: `trip-service`, `participant-service`, `invitation-service`, `expense-service`, `balance-service`, `settlement-service`, `report-service`, `auth-service`; pure calculators in `domain/`.
- **O** — split strategies are data-driven (`SplitMethod` + `computeSplit`); adding a method extends one switch and its validation without touching expense/settlement logic.
- **L/I** — services expose small function contracts; API handlers depend only on what they call.
- **D** — domain knows nothing about HTTP, Prisma, or React; services depend on the domain, not vice versa.

## Identity model (users vs participants)

The key design decision for guests:

- **User** — a registered account (email + password).
- **Participant** — a stable per-trip financial identity. May be linked to a user (`userId`) or a **guest** (`userId = null`).

Every financial row (payer contribution, allocation, settlement) references a **participant id**, never a user id. Consequences:

- Guests work with no fake emails or shared accounts.
- Claiming a guest identity = setting `userId` on the participant (guarded by a conditional `updateMany` inside the join transaction so two users can't claim the same spot). History transfers automatically because nothing else changes.
- Removing a participant with history = `isActive = false` (soft deactivation); their records stay intact and they're excluded from new expenses. Participants with no records are hard-deleted.

## Entity relationships

```
User 1──* Session
User 1──* PasswordResetToken
User 1──* Trip (createdBy)
User 0..1──* Participant (null = guest)

Trip 1──* Participant
Trip 1──* TripInvitation (tokenHash unique; optional claim target participant)
Trip 1──* Expense 1──* ExpensePayerContribution *──1 Participant
                  1──* ExpenseAllocation        *──1 Participant
Trip 1──* Settlement (from/to Participant, status CONFIRMED|REVERSED)
Trip 1──* ActivityLog (append-only audit)
```

Indexes cover the hot paths: expenses by `(tripId, spentAt desc)` and `(tripId, category)`, financial rows by participant, activity by `(tripId, createdAt desc)`.

## Financial correctness

- **Representation:** integer minor units (`Int`), currency code on the trip. No floats anywhere in money math; user input is parsed digit-wise (`parseAmountToMinor`), never via `parseFloat`.
- **Invariants** (service-validated, DB-reinforced with CHECK constraints):
  1. `sum(allocations) == expense.amountMinor` exactly;
  2. `sum(payerContributions) == expense.amountMinor` exactly;
  3. amounts positive (allocations may be explicitly 0); settlements never self-pay.
- **Deterministic rounding:** proportional splits floor each share, then distribute leftover minor units by largest remainder, ties by input order (BigInt intermediates prevent overflow). Same input → same output, client and server.
- **Transactions:** every multi-row write (expense + payers + allocations + audit entry; claim + invite counter; reversal + audit) runs in a single `prisma.$transaction`. No partial writes.
- **Derived, not stored:** balances are always computed from authoritative rows — contributions, allocations, CONFIRMED settlements. `reconciliationTotal` asserts the zero-sum property and is exercised in tests.
- **Balances:** `net = paid − allocated`; `outstanding = net + settlementsPaid − settlementsReceived`. Reversing a settlement flips its status (auditable), never deletes.

## Settlement algorithm

Greedy largest-debtor → largest-creditor matching over outstanding balances (`src/domain/settlement.ts`). O(n log n), at most `debtors + creditors − 1` transfers, deterministic (ties broken by participant id). A globally minimal transfer count is NP-hard (subset-sum matching); the greedy result is optimal for the common all-to-one case and near-minimal otherwise — correctness and determinism were chosen over an expensive global optimum. Suggestions are recomputed from live balances on every view and are never auto-marked as paid.

## Security

- Sessions: 256-bit random tokens in httpOnly/SameSite=Lax/Secure cookies; only salted SHA-256 hashes stored; 30-day expiry; password change/reset revokes all sessions.
- Passwords: bcrypt (cost 12); login compares against a dummy hash when the email is unknown (no timing/enumeration signal); password reset never reveals account existence.
- Authorization at the resource level: every trip-scoped operation resolves the caller's active Participant row first (`requireTripAccess` / `requireTripAdmin`); outsiders get 404, not 403, so trip ids can't be probed. Participant ids in payloads are re-verified against the trip.
- Invite + reset tokens stored hashed; invites expire, are use-limited, revocable, and shown exactly once.
- Validation: zod on every request body; Prisma parameterized queries (no SQL injection); React escaping (no XSS); SameSite cookies + JSON APIs (CSRF posture); fixed-window rate limiting on auth/invite endpoints backed by a Postgres bucket table, so limits hold across serverless instances and cold starts.
- Headers: Content-Security-Policy (self-only scripts/connect targets, no framing), `nosniff`, `DENY` framing, restrictive referrer/permissions policies; `Cache-Control: no-store` on all API responses.
- Emailed links use the configured `APP_URL`, never the request's Host header. `SESSION_SECRET` is fail-fast in production.
- Logs never contain passwords, tokens, or session secrets. The audit log stores snapshots of financial changes only.

## PWA stance

Manifest + service worker with a deliberately conservative policy: static assets cache-first (content-hashed), navigations network-first with an offline fallback page, **`/api/*` and non-GET never cached**. Offline expense queueing was considered and deferred: silently queueing financial writes risks duplicate/conflicting records; the settlement UI already uses client idempotency keys for retry-safety, which is the part of offline tolerance that matters most.

## Testing strategy

- **Unit (npm test):** pure domain — all split methods, remainder exhaustion over thousands of awkward amounts, payer validation, balance math, settlement engine (including the spec's worked examples).
- **Integration (npm run test:integration):** real services against a dedicated Postgres database — the complete Goa journey (signup → invite claim → five mixed-split expenses → balances → suggestions → partial/idempotent settlement → reversal → report/CSV → close/reopen), authorization boundaries, double-claim races, atomicity, DB constraints, pagination, audit trail.
- **E2E (npm run test:e2e):** Playwright driving a real browser against a running build — signup → trip with guests → every split type (equal/exact/percentage/shares, subset sharing, multi-payer) → balances and settlement plan read off the rendered page → partial payment → full settlement → trip completion → final report → CSV download → invite-link claim by a second browser context inheriting the claimed participant's history → expense edit recalculating on-screen balances. Runs on `desktop` (Chromium) and `mobile` (Chromium with iPhone 14 viewport/touch/UA). A `webkit-ios` project is defined for genuine WebKit coverage but is blocked on this dev machine — Playwright's WebKit build is frozen for its macOS version (`newPage()` fails before any app code runs); run it on a current macOS for true Safari-engine verification.
- **Accessibility (npm run test:a11y):** axe-core (WCAG 2.1 A/AA/21AA rule sets) run across all 15 screens via Playwright, at the mobile device viewport, both signed-out and signed-in with real trip/expense data so every state (including all four split-method forms) is covered. Catches real issues static review misses — e.g. this suite found and fixed an unlabeled icon-only nav link that had zero accessible name on mobile, two Badge color combinations under the 4.5:1 AA contrast minimum, invalid ARIA on the toast region, and a keyboard-unreachable scrollable table.
- The screenshot script used for UI verification lives in `shots/` and doubles as a Playwright starting point for browser e2e.

## Operational notes

- Config via environment (`.env.example`); Prisma config in `prisma7.config.ts`.
- Health: the app serves `/login` unauthenticated — use it (or add `/api/health`) for liveness probes.
- Backup/recovery: scheduled `pg_dump`, restore + `prisma migrate deploy`; migrations are append-only and versioned in `prisma/migrations`.
- Scaling path (when needed): add read replicas for report queries; extract nothing until a measurable driver appears.
