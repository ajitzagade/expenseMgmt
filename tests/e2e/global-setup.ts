import "dotenv/config";
import { Client } from "pg";

/** Repeated local runs share one client IP: reset throttle state per run. */
export default async function globalSetup(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DELETE FROM "RateLimitBucket"');
  await client.end();
}
