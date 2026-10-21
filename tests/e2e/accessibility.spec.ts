import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * WCAG 2.1 AA audit (axe-core) across every screen, at the project's device
 * viewport. One shared authenticated session (storageState) is reused across
 * tests so repeated logins never trip the auth rate limiter.
 */

const run = Date.now();
const EMAIL = `a11y-${run}@example.com`;
const PASSWORD = "a11y-password-123";
let tripUrl = "";
let sharedPage: Page;

async function auditPage(page: Page, label: string) {
  // Let CSS entrance animations (0.4s) settle before sampling colors —
  // auditing mid-fade reports transient, not steady-state, contrast.
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node${v.nodes.length > 1 ? "s" : ""})`)
      .join("\n");
    console.log(`\n--- a11y violations on ${label} ---\n${summary}\n`);
  }
  expect(results.violations, `${label}: ${results.violations.map((v) => v.id).join(", ")}`).toEqual([]);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  sharedPage = page;
  await page.goto("/signup");
  await page.fill("#name", "A11y Tester");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome");
  await page.goto("/trips/new");
  await page.fill("#name", `A11y Trip ${run}`);
  await page.getByLabel("Travel mate 1").fill("Buddy");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/\/trips\/(?!new$)[a-z0-9]+$/);
  tripUrl = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Expenses" }).first().click();
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await page.fill("#amount", "500");
  await page.fill("#title", "Snacks");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.waitForURL("**/expenses");
});

test.describe("accessibility — unauthenticated", () => {
  test("login", async ({ page }) => {
    await page.goto("/login");
    await auditPage(page, "/login");
  });
  test("signup", async ({ page }) => {
    await page.goto("/signup");
    await auditPage(page, "/signup");
  });
  test("forgot password", async ({ page }) => {
    await page.goto("/forgot-password");
    await auditPage(page, "/forgot-password");
  });
});

test.describe("accessibility — authenticated app", () => {
  // One already-logged-in page reused across tests (closure, not the `page`
  // fixture) so 11 audits never re-trigger the login rate limiter.
  test("trips overview", async () => {
    await sharedPage.goto("/trips");
    await auditPage(sharedPage, "/trips");
  });
  test("new trip", async () => {
    await sharedPage.goto("/trips/new");
    await auditPage(sharedPage, "/trips/new");
  });
  test("trip dashboard", async () => {
    await sharedPage.goto(tripUrl);
    await auditPage(sharedPage, "trip dashboard");
  });
  test("expenses list", async () => {
    await sharedPage.goto(`${tripUrl}/expenses`);
    await auditPage(sharedPage, "expenses list");
  });
  test("add expense (all split modes)", async () => {
    await sharedPage.goto(`${tripUrl}/expenses/new`);
    await sharedPage.fill("#amount", "900");
    for (const mode of ["Equally", "Exact amounts", "Percentages", "Shares"]) {
      await sharedPage.getByRole("radio", { name: mode }).click();
      await auditPage(sharedPage, `add expense (${mode})`);
    }
  });
  test("expense detail", async () => {
    await sharedPage.goto(`${tripUrl}/expenses`);
    await sharedPage.getByRole("link", { name: /Snacks/ }).first().click();
    await auditPage(sharedPage, "expense detail");
  });
  test("participants", async () => {
    await sharedPage.goto(`${tripUrl}/participants`);
    await auditPage(sharedPage, "participants");
  });
  test("settle up", async () => {
    await sharedPage.goto(`${tripUrl}/settle`);
    await auditPage(sharedPage, "settle up");
  });
  test("report", async () => {
    await sharedPage.goto(`${tripUrl}/report`);
    await auditPage(sharedPage, "report");
  });
  test("settings", async () => {
    await sharedPage.goto(`${tripUrl}/settings`);
    await auditPage(sharedPage, "settings");
  });
  test("profile", async () => {
    await sharedPage.goto("/profile");
    await auditPage(sharedPage, "profile");
  });
  test("welcome", async () => {
    await sharedPage.goto("/welcome");
    await auditPage(sharedPage, "welcome");
  });
});
