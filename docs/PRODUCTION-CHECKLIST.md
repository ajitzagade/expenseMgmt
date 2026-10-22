# Production readiness checklist

Status: **live** at https://tripsplit.azentis.in. This list reflects what's actually been done and verified, not aspirational targets.

## Done and verified

- [x] Financial engine unit-tested (37 tests) incl. deterministic rounding, remainder exhaustion, and the reference scenarios
- [x] Service-layer integration tests (34 tests) against real Postgres: full journey, authz, atomicity, idempotency, races, constraints, edge cases (solo trips, 13-way splits, over-settlement, edits after settlement)
- [x] Browser E2E suite (Playwright, desktop + mobile): signup → trip → every split type → balances read off the rendered page → partial/full settlement → completion → report → CSV → invite-link claim
- [x] WCAG 2.1 AA accessibility audit (axe-core) across all 15 screens — zero violations; 4 real issues found and fixed during the first pass
- [x] Verified mobile-responsive: no horizontal scroll on any screen across 360–768px viewports; inline editors/forms confirmed tappable, not just non-overflowing
- [x] All monetary values integer minor units; DB CHECK constraints as a second line of defense
- [x] Atomic transactions for every multi-row financial write; append-only audit log
- [x] Resource-level authorization on every trip-scoped endpoint; outsiders get 404; multi-tenancy isolation verified live on production with a second real account
- [x] Session cookies httpOnly/SameSite/Secure; tokens stored hashed; bcrypt(12) passwords; `SESSION_SECRET` fails fast if unset in production
- [x] Postgres-backed rate limiting (shared across serverless instances, not per-instance memory)
- [x] Security headers incl. CSP; `no-store` on API responses; CSV export hardened against spreadsheet-formula injection; open-redirect closed
- [x] Versioned migrations (8 to date); idempotent dev seed (six trips spanning 1–10 days, 1–10 people, every status and split method); `.env.example` with placeholders only
- [x] Installable PWA with cache policy that never caches financial data
- [x] Strict TypeScript; production build passes; deployed and live-smoke-tested after every change (see `docs/DEPLOYMENT.md`)
- [x] Managed PostgreSQL provisioned, migrated, and **claimed** (see incident log in `docs/DEPLOYMENT.md` for why "claimed" is load-bearing)
- [x] `APP_URL` set to the canonical origin; `SESSION_SECRET` generated and set outside version control
- [x] HTTPS via Vercel + the custom domain's certificate

## Known gaps (deliberately deferred, not forgotten)

- [ ] Transactional email provider — `src/server/mailer.ts` is a console-logging stub; password reset has never sent a real email
- [ ] Error monitoring (e.g. Sentry) and a dedicated `/api/health` liveness endpoint — currently `vercel logs` is the only window into production errors, which is how the 2026-10-21 outage was first *reported* by a user rather than *detected* automatically
- [ ] Real WebKit/Safari-engine E2E coverage — blocked by a frozen WebKit build on the primary dev machine; Chromium's iPhone emulation is used as a proxy (documented in `docs/ARCHITECTURE.md`)
- [ ] Manual screen-reader pass (VoiceOver/TalkBack) — axe-core covers automatable WCAG rules, not actual assistive-tech usability
- [ ] Load/concurrency testing beyond the specific races already covered (idempotency, settlement double-submit) — no realistic concurrent-traffic test has been run
- [ ] Data-retention / account-deletion policy for your jurisdiction — not yet defined
