import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E suite. Runs against a production build on :3000 using the dev
 * database (data it creates is namespaced by unique emails/trip names).
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // iPhone viewport/UA/touch on the Chromium engine. True WebKit coverage
    // is blocked on this machine: Playwright's WebKit build is frozen for
    // this macOS version (`playwright install webkit` warns about it, and
    // newPage() hangs/errors before any app code runs) — an environment
    // limitation, not something the app can work around. Run `npx playwright
    // test --project=webkit-ios` on a current macOS to get real engine
    // coverage; the project definition below is ready for that.
    { name: "mobile", use: { ...devices["iPhone 14"], defaultBrowserType: "chromium" } },
    { name: "webkit-ios", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
