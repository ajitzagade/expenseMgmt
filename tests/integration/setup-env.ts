import "dotenv/config";

// Point the service layer's Prisma client at the test database. This runs
// before any test file (and therefore before src/lib/db.ts) is imported.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET ??= "integration-test-secret";
