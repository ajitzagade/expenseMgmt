import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration tests: run the real service layer against the dedicated
 * TEST_DATABASE_URL Postgres database (never the dev database).
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
