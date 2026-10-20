# Production readiness checklist

## Done in this codebase

- [x] Financial engine unit-tested (33 tests) incl. deterministic rounding and the reference scenarios
- [x] Service-layer integration tests (20 tests) against real Postgres: full journey, authz, atomicity, idempotency, constraints
- [x] All monetary values integer minor units; DB CHECK constraints as a second line of defense
- [x] Atomic transactions for every multi-row financial write; append-only audit log
- [x] Resource-level authorization on every trip-scoped endpoint; outsiders get 404
- [x] Session cookies httpOnly/SameSite/Secure; tokens stored hashed; bcrypt(12) passwords
- [x] Rate limiting on auth/invite endpoints; zod validation on every body
- [x] Security headers incl. CSP; `no-store` on API responses; no secrets in client code or logs
- [x] Postgres-backed rate limiting (works across serverless instances)
- [x] Versioned migrations; idempotent dev seed; `.env.example` with placeholders only
- [x] Responsive UI incl. mobile; installable PWA with cache policy that never caches financial data
- [x] Strict TypeScript; production build passes

## Before going live (environment work)

- [ ] Provision managed PostgreSQL; set `DATABASE_URL`; run `npx prisma migrate deploy`
- [ ] Generate a strong `SESSION_SECRET` (secrets manager, not committed) and set `APP_URL` to the canonical origin
- [ ] Serve behind HTTPS with HSTS at the proxy/host
- [ ] Wire `src/server/mailer.ts` to a transactional email provider (password reset links)
- [ ] Scheduled `pg_dump` backups + a tested restore runbook
- [ ] Error monitoring (e.g. Sentry) and structured request logging at the host
- [ ] Uptime check against `/login`
- [ ] Review data-retention/account-deletion policy for your jurisdiction
