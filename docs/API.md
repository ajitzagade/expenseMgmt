# TripSplit REST API

All endpoints are JSON over HTTPS, cookie-authenticated (`ts_session`, httpOnly). Amounts are **integer minor units** (paise) in the trip currency.

Conventions:
- Success: `200`/`201` with a JSON body.
- Errors: `{ "error": { "code": "...", "message": "..." } }` with `400` (validation/domain), `401`, `403`, `404`, `409` (conflict), `429` (rate limited), `500`.
- Server-side validation on every request (zod); participant ids are always re-checked against trip membership.
- Mutating financial endpoints are atomic; settlement recording accepts a client `idempotencyKey` (UUID) so retries never double-record.

## Auth & profile

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{email, password, name, preferredCurrency?}` | 201; sets session cookie. Rate limited. |
| POST | `/api/auth/login` | `{email, password}` | Sets session cookie. Rate limited. |
| POST | `/api/auth/logout` | — | Clears session. |
| POST | `/api/auth/forgot-password` | `{email}` | Always 200 (no account enumeration); link via mailer. |
| POST | `/api/auth/reset-password` | `{token, newPassword}` | Revokes all sessions. |
| GET | `/api/me` | — | Current user. |
| PATCH | `/api/me` | `{name?, preferredCurrency?}` | |
| POST | `/api/me/password` | `{currentPassword, newPassword}` | Revokes other sessions, reissues this one. |

## Trips

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/api/trips` | — | Trips for the current user with totals. |
| POST | `/api/trips` | `{name, destination?, description?, startDate?, endDate?, currency, colorIndex, participantNames[], companionUserIds[]}` | Creator becomes ADMIN participant; names become guests. `companionUserIds` pre-adds registered users as linked members — only allowed for people who already share a trip with the creator. |
| GET | `/api/trips/:tripId` | — | Overview: trip, participants with balances, totals, category breakdown, recent activity. |
| PATCH | `/api/trips/:tripId` | trip fields and/or `{status}` | Admin only. Closed trips accept only a status change (reopen). |

## Participants & invitations

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/trips/:tripId/participants` | `{name}` | Any active member adds a guest. |
| PATCH | `/api/trips/:tripId/participants/:id` | `{name}` or `{reactivate: true}` | Admin. Rename guests only. |
| DELETE | `/api/trips/:tripId/participants/:id` | — | Admin. Returns `{removed: "deleted"\|"deactivated"}` — history is preserved when records exist. |
| GET | `/api/trips/:tripId/invitations` | — | Admin. Active invites (tokens are never re-shown). |
| POST | `/api/trips/:tripId/invitations` | `{participantId?}` | Admin. Returns `{token, joinPath, expiresAt}` **once**. Targeted invites claim a specific guest. |
| DELETE | `/api/trips/:tripId/invitations/:id` | — | Admin. Revoke. |
| GET | `/api/invitations/:token` | — | Public invite info: trip name, claimable guest identities. |
| POST | `/api/invitations/accept` | `{token, claimParticipantId?}` | Join as new participant or claim a guest identity (race-safe). |

## Expenses

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/api/trips/:tripId/expenses` | `?category&participantId&payerId&q&cursor&limit` | Cursor pagination, newest first. |
| POST | `/api/trips/:tripId/expenses` | see below | Member. Atomic create. |
| GET | `/api/trips/:tripId/expenses/:id` | — | Full detail with payers + allocations. |
| PUT | `/api/trips/:tripId/expenses/:id` | same as create | Creator or admin. Replaces payers/allocations atomically; audited. |
| DELETE | `/api/trips/:tripId/expenses/:id` | — | Creator or admin; audited with snapshot. |
| POST | `/api/trips/:tripId/expenses/preview` | `{amountMinor, splitMethod, participants[]}` | Authoritative split preview (no write). |

Expense write body:

```jsonc
{
  "title": "Drinks",
  "amountMinor": 120000,              // ₹1,200.00
  "category": "Drinks",               // suggested or custom (≤30 chars)
  "spentAt": "2026-11-07T20:00:00+05:30",
  "notes": "optional", "merchant": "optional",
  "payers": [ {"participantId": "...", "amountMinor": 120000} ],   // 1..n, must sum to amountMinor
  "splitMethod": "EQUAL",             // EQUAL | EXACT | PERCENTAGE | SHARES | CUSTOM
  "participants": [                   // who shares it — independent of payers
    {"participantId": "..."},                          // EQUAL
    {"participantId": "...", "exactMinor": 60000},     // EXACT/CUSTOM
    {"participantId": "...", "percentBps": 5000},      // PERCENTAGE (100 bps = 1%, must total 10000)
    {"participantId": "...", "shares": 2}              // SHARES
  ]
}
```

## Settlements & reports

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/api/trips/:tripId/settlements` | — | Balances, suggested transfers, recorded payments. |
| POST | `/api/trips/:tripId/settlements` | `{fromParticipantId, toParticipantId, amountMinor, method?, note?, paidAt?, idempotencyKey?}` | Record a real (possibly partial) payment. Idempotent per key. |
| POST | `/api/trips/:tripId/settlements/:id/reverse` | `{reason}` | Admin or recorder. Marks REVERSED (audited), never deletes. |
| GET | `/api/trips/:tripId/report` | `?format=csv` | Full report JSON, or CSV download. |
| GET | `/api/trips/:tripId/activity` | `?cursor&limit` | Append-only audit history. |
