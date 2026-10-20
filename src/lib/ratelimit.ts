import "server-only";
import { prisma } from "./db";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * serverless instances and cold starts (an in-memory map would silently
 * reset per instance). One atomic upsert per check.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  if (row.count > limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)) };
  }
  // Opportunistic cleanup of long-expired buckets (~1% of checks).
  if (Math.random() < 0.01) {
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } }).catch(() => undefined);
  }
  return { ok: true, retryAfterSeconds: 0 };
}
