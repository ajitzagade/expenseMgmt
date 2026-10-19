import { execSync } from "node:child_process";
import "dotenv/config";

/** Applies all migrations to the dedicated test database before the run. */
export default function globalSetup(): void {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });
}
