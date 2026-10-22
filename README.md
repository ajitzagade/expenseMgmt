# TripSplit — Trip Expense Management

A production-grade app for groups travelling together: create a trip, add your travel mates (accounts optional), record who paid each bill and who actually shared it, watch live balances, and settle up with the fewest transfers.

Built as a Next.js modular monolith: React 19 + TypeScript (strict), REST API route handlers, PostgreSQL via Prisma 7, Tailwind CSS 4, installable PWA.

**Live deployment:** https://tripsplit.azentis.in — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for how it's hosted, how to redeploy, and the database-recovery runbook.

## Quick start

Prerequisites: Node 22+, PostgreSQL 14+ running locally.

```bash
# 1. Install
npm install

# 2. Create databases
createdb tripsplit_dev
createdb tripsplit_test

# 3. Configure
cp .env.example .env     # then edit DATABASE_URL / TEST_DATABASE_URL / SESSION_SECRET

# 4. Migrate + seed the demo trip
npx prisma migrate dev
npx prisma db seed

# 5. Run
npm run dev              # http://localhost:3000
```

Demo sign-ins after seeding: `ajit@example.com` / `password123` (trip admin), or `rahul@`, `meera@`, `vikram@example.com` (same password) — see `prisma/seed.ts` for the full six-trip portfolio (1–10 day trips, 1–10 person groups, every split method, every trip status). On the live deployment, additional `@azentis.in` team accounts exist; their current password is held outside this repo — ask the project owner rather than looking for it in git history.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (split, balance, settlement engines) |
| `npm run test:integration` | Service-layer tests against `TEST_DATABASE_URL` (applies migrations, wipes data) |
| `npm run test:e2e` | Browser E2E suite (Playwright): full user journey, desktop + mobile — see below |
| `npm run test:a11y` | WCAG 2.1 AA audit (axe-core) across all 15 screens at mobile viewport |
| `npm run typecheck` | Strict TypeScript check |
| `npx prisma migrate dev` | Apply/create database migrations |
| `npx prisma db seed` | Seed the demo trip (idempotent) |

## How money works (the short version)

- Every amount is stored as **integer minor units** (paise) in the trip's single currency — floats never touch financial math.
- Each expense records **who paid** (one or many payers) and **who shared it** — independent selections; the payer need not share the bill.
- Split methods per expense: equal, exact amounts, percentages, shares. Remainders are distributed deterministically (₹100 ÷ 3 → ₹33.34 / ₹33.33 / ₹33.33 — never a lost paisa).
- Invariants enforced in one database transaction per write, plus CHECK constraints in Postgres: allocations sum to the expense total, payer contributions sum to the expense total.
- **Net balance = paid − allocated.** Confirmed settlement payments adjust the outstanding balance without touching expense history; reversals are audited corrections, never deletes.
- The settlement engine proposes a deterministic, near-minimal set of transfers from live outstanding balances. All balances always reconcile to zero.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design (ERD, modules, decisions and trade-offs), [docs/API.md](docs/API.md) for the REST API, [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for hosting/ops/incident history, and [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards.

## Features

- Email/password auth with DB-backed sessions, password change and reset flow (dev mailer logs the link), rate-limited endpoints.
- Trips with status lifecycle (upcoming → ongoing → completed/archived, reopenable), colors, dates, per-trip currency, and a color-coded trip icon.
- Guest participants by name — no account needed; secure one-time invite links; guests can **claim** their identity later and keep their history; a **companion picker** on trip creation lets you one-tap add people from your past trips (registered members join instantly, remembered guests come along by name).
- Expense CRUD with categories (+ custom), multi-payer, per-expense split config (equal / exact / percentage / shares), live split preview that matches the server exactly, filters and pagination, and **idempotent creation** (a client retry key prevents double-submission, even under a race).
- Live balances, per-participant breakdown ("how was this calculated"), settlement suggestions, partial payments, idempotent recording, auditable reversal.
- Final report with per-person summary, category breakdown, CSV export (spreadsheet-formula-injection-safe), and a print-clean layout.
- Append-only activity log for material financial changes.
- Installable PWA: app-shell caching only — financial data is never served from a cache; offline banner + fallback page.
- Verified mobile-responsive (no horizontal scroll on any screen, 360–768px) and **WCAG 2.1 AA accessible** (axe-core audit, zero violations across all 15 screens) — see `npm run test:a11y`.

## Deployment notes

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full picture (current host, environment variables, redeploy steps, backup/recovery, and a real incident writeup). Summary:

- Hosted on Vercel (Singapore region, next to the database) at `tripsplit.azentis.in`; any Node host works generally. Set `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`; run `npx prisma migrate deploy` on release; serve over HTTPS.
- Rate limiting is Postgres-backed (shared across serverless instances).
- **The production database must be a claimed (not a temporary/trial) instance** — an unclaimed one auto-deletes within ~24 hours and has already caused one full outage. See the incident log in `docs/DEPLOYMENT.md` before provisioning a new database.

## Known limitations / deferred features

Documented deliberately rather than half-built:

- **Single currency per trip.** Multi-currency needs an explicit exchange-rate model; amounts in different currencies are never silently combined.
- **Receipt image uploads** — needs blob storage; schema and UI leave room for it.
- **OAuth sign-in** — the auth seam is small; email/password ships first.
- **PDF export** — CSV + print view ship instead.
- **Offline expense queueing** — writes require the server by design (correctness over convenience); the PWA shell works offline for reading guidance only.
- **Email delivery** is a console-logging stub until an SMTP/provider credential is configured (`src/server/mailer.ts`).
