# Contributing to TripSplit

## Ground rules for financial code

1. **Money is integer minor units.** Never `parseFloat` user amounts (use `parseAmountToMinor`), never do money math in floats, never format with arithmetic that can round.
2. **Invariants are non-negotiable:** allocations sum to the expense total; payer contributions sum to the expense total. If you touch expense writes, keep both checks inside the same transaction as the write.
3. **Balances are derived.** Don't introduce stored totals without a documented reconciliation strategy.
4. **Every material financial change gets an ActivityLog entry in the same transaction.**
5. Corrections are audited state changes (e.g. settlement `REVERSED`), not deletes.

## Layering

`src/domain` (pure, no I/O) ← `src/server/services` (authz + transactions) ← `src/app/api` (parse/validate/map errors) and `src/app/**` pages. Dependencies point inward only. Domain code must stay importable from the browser.

- New trip-scoped operations start with `requireTripAccess` / `requireTripAdmin`.
- Validate every request body with a zod schema in `src/server/schemas.ts`.
- Throw `AppError` (services) or `DomainError` (domain); the API wrapper maps them. Don't catch-and-swallow.

## Style

- TypeScript strict; no `any` without a comment justifying it.
- Server-only modules import `"server-only"`.
- UI: use the primitives in `src/components/ui.tsx` and theme tokens in `globals.css` — no ad-hoc colors or inline styles for things a token covers. Financial figures use the `Money` component (tabular numerals, sign + color together).
- Keep components focused; extract client islands rather than making whole pages `"use client"`.
- Accessibility: label every input, keep visible focus, never color-only status.

## Workflow

```bash
npm run typecheck && npm test        # fast feedback
npm run test:integration             # service layer against TEST_DATABASE_URL
npm run build                        # must pass before merging
```

- Schema changes: `npx prisma migrate dev --name <change>` — migrations are append-only; never edit an applied migration.
- Add unit tests for any new split/balance behavior and an integration test for any new service path that writes money.
- Never log secrets, tokens, or passwords. Never commit `.env`.
