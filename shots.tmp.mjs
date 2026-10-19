import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(800); // hydration
  await page.fill("#email", "ajit@example.com");
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
  await page.waitForTimeout(300);
  await page.waitForURL("**/trips");
}

// Desktop
const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const page = await desktop.newPage();

await page.goto(`${BASE}/login`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}01-login.png` });

await login(page);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}02-trips.png` });

const tripUrl = await page.locator('a[href^="/trips/c"]').first().getAttribute("href");
await page.goto(`${BASE}${tripUrl}`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}03-dashboard.png`, fullPage: true });

await page.goto(`${BASE}${tripUrl}/expenses`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}04-expenses.png` });

// Expense detail: the Drinks expense (shared by only two people)
await page.goto(`${BASE}${tripUrl}/expenses`);
await page.locator('a[href*="/expenses/"]', { hasText: "Drinks" }).first().click();
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}05-expense-detail.png`, fullPage: true });

await page.goto(`${BASE}${tripUrl}/expenses/new`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
// Fill a realistic scenario: ₹1,500 lunch paid by Ajit, shared by 3 of 4.
await page.fill("#amount", "1500");
await page.fill("#title", "Beach shack lunch");
await page.locator('input[type="checkbox"]').nth(2).uncheck();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}06-add-expense.png`, fullPage: true });

await page.goto(`${BASE}${tripUrl}/settle`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}07-settle.png`, fullPage: true });

await page.goto(`${BASE}${tripUrl}/report`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}08-report.png`, fullPage: true });

await page.goto(`${BASE}${tripUrl}/participants`);
await page.waitForLoadState("load"); await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}09-participants.png` });

// Trigger a real CRUD action to capture the toast
await page.fill('input[aria-label="Name"]', "Priya");
await page.getByRole("button", { name: "Add" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}13-toast.png` });
// Clean up the demo participant (no records -> hard delete)
await page.getByRole("button", { name: "Remove" }).last().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Remove" }).last().click();
await page.waitForTimeout(800);

await desktop.close();

// Mobile (iPhone-ish)
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const m = await mobile.newPage();
await login(m);
await m.goto(`${BASE}${tripUrl}`);
await m.waitForLoadState("load"); await m.waitForTimeout(700);
await m.screenshot({ path: `${OUT}10-mobile-dashboard.png` });
await m.goto(`${BASE}${tripUrl}/expenses/new`);
await m.waitForLoadState("load"); await m.waitForTimeout(700);
await m.fill("#amount", "1200");
await m.fill("#title", "Drinks round two");
await m.screenshot({ path: `${OUT}11-mobile-add-expense.png` });
await m.goto(`${BASE}${tripUrl}/settle`);
await m.waitForLoadState("load"); await m.waitForTimeout(700);
await m.screenshot({ path: `${OUT}12-mobile-settle.png` });
await mobile.close();

await browser.close();
console.log("done");
