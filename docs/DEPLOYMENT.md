# Deployment & Operations

## Current hosting

| Component | Provider | Notes |
| --- | --- | --- |
| App | Vercel project `tripsplit` (team `arthadrishtiinfo-7245s-projects`) | Functions pinned to `sin1` (Singapore), next to the database, via `vercel.json` and the project's `serverlessFunctionRegion` setting |
| Database | Prisma Postgres, Singapore region | **Must be a claimed instance** — see incident log below |
| Domain | `tripsplit.azentis.in` | CNAME → `cname.vercel-dns.com`, DNS hosted on Hostinger |

Public URL: **https://tripsplit.azentis.in**

## Environment variables (production, set via Vercel)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (driver-adapter / `@prisma/adapter-pg`) |
| `SESSION_SECRET` | Pepper for session-token hashing. **Fails fast at runtime if unset in production** (`src/lib/session.ts`) — this is intentional, not a bug. |
| `APP_URL` | Canonical origin used in emailed links (password reset). Prevents Host-header spoofing from poisoning reset links. |

`.env.example` documents the local/dev equivalents.

## Redeploying

```bash
npx vercel@latest deploy --prod --yes
```

Run `npx prisma migrate deploy` against the production `DATABASE_URL` **before** deploying if the change includes a new migration — Vercel does not run migrations automatically. After deploying, do a live smoke check (login, one trip page, one write) rather than trusting the build log alone; see the verification pattern used throughout this project's history — curl the login API, pull a trip id, hit a few pages, confirm 200s.

## Backups

- `pg_dump "$DATABASE_URL" | gzip > tripsplit-$(date +%F).sql.gz` on a schedule.
- Restore: `gunzip -c backup.sql.gz | psql "$DATABASE_URL"`, then `npx prisma migrate deploy` to confirm schema state matches `prisma/migrations/`.
- Test restores periodically — an untested backup is not a backup.

## Incident log

### 2026-10-21 — full production outage (unclaimed database auto-deletion)

**What happened:** The production database had been provisioned via Prisma's `create-db` quick-start flow, which creates a **temporary, unclaimed** instance that auto-deletes roughly 24 hours after creation unless claimed into a real Prisma account. It was not claimed in time. Around 24h after provisioning, every database query started failing with `Failed to identify your database: Your Postgres credentials are incorrect` — which is what Prisma Postgres returns once an instance is gone, not a credentials typo. This took down the entire app (login, every page, every API route), not just the page first reported as broken.

**Detection:** Reported as "the report page is throwing 500." Investigation (via `vercel logs` and a direct `psql` connection) showed the *login* endpoint failing identically, which revealed the outage was total, not localized to one route.

**Root cause:** Using a trial/unclaimed database for a production deployment without claiming it immediately, and without a monitoring alert for database reachability.

**Resolution:**
1. Confirmed via direct `psql` connection that the old instance was genuinely gone (not a config error).
2. Provisioned a fresh Prisma Postgres instance (same region), ran all migrations (`prisma migrate deploy`), reseeded demo data (`prisma db seed`).
3. Updated `DATABASE_URL` in Vercel and redeployed.
4. Recreated accounts that existed only in the deleted database (the `@azentis.in` team logins).
5. **Claimed the new database immediately** into a permanent Prisma account — this is the step that was skipped the first time.

**Data lost:** Anything created in the ~36 hours between the original provisioning and the outage that wasn't captured by the seed script — specifically, any real usage under the `@azentis.in` accounts during that window.

**Prevention for next time:**
- **Any database used for anything beyond a same-session throwaway demo must be claimed into a real account the moment it's created** — do not defer this.
- Before relying on a new database for production, verify it is not on a trial/temporary tier (check the provider's dashboard or claim-status API, not just that a connection string was returned).
- Consider adding an uptime check against `/login` or a dedicated `/api/health` route so a full outage surfaces automatically instead of via a user bug report.
- Prisma Postgres provisioned via `create-db` always returns a `claimUrl` in its response — treat an unclaimed `claimUrl` as a standing TODO, not a nice-to-have.

## Observability

No external error-tracking/APM is currently wired up. `vercel logs` / the Vercel dashboard's runtime logs are the only visibility into production errors. Adding Sentry (or similar) and a `/api/health` liveness endpoint are the two highest-value gaps if this app grows beyond ad-hoc operation.
