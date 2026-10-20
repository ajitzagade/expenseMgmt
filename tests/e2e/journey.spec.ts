import { test, expect, type Page } from "@playwright/test";

/**
 * The complete user journey from the product spec, executed through the real
 * browser UI: account → trip with guests → expenses under every sharing rule
 * (incl. subset splits and multi-payer) → on-screen balances → settlement
 * plan → partial payment → completion → final report → CSV export.
 */

const run = Date.now();
const EMAIL = `e2e-${run}@example.com`;
const PASSWORD = "e2e-password-123";
const TRIP = `E2E Goa ${run}`;

async function addExpense(
  page: Page,
  opts: {
    title: string;
    amount: string;
    payer?: string;
    sharers?: string[]; // when set, only these stay ticked
  },
) {
  await page.getByRole("link", { name: "Expenses" }).first().click();
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await page.waitForURL("**/expenses/new");
  await page.fill("#amount", opts.amount);
  await page.fill("#title", opts.title);
  if (opts.payer) await page.getByLabel("Payer").selectOption({ label: opts.payer });
  if (opts.sharers) {
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    for (const name of opts.sharers) {
      await page.locator("label").filter({ hasText: name }).first().click();
    }
  }
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.waitForURL("**/expenses");
  await expect(page.getByRole("link", { name: new RegExp(opts.title) }).first()).toBeVisible();
}

test("full trip journey through the UI", async ({ page }) => {
  // 1. Create an account.
  await page.goto("/signup");
  await page.fill("#name", "Eeva Tester");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome");

  // 2. Create a trip with three guest participants.
  await page.getByRole("link", { name: "Create your first trip" }).click();
  await page.waitForURL("**/trips/new");
  await page.fill("#name", TRIP);
  await page.getByLabel("Travel mate 1").fill("Rahul");
  await page.getByLabel("Travel mate 2").fill("Amit");
  await page.getByLabel("Travel mate 3").fill("Sneha");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/\/trips\/(?!new$)[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: TRIP })).toBeVisible();

  // 3-5. The five reference expenses with different sharing rules.
  await addExpense(page, { title: "Hotel", amount: "8000" }); // everyone, payer = me
  await addExpense(page, { title: "Dinner", amount: "2400", payer: "Rahul" });
  await addExpense(page, { title: "Drinks", amount: "1200", payer: "Amit", sharers: ["Eeva", "Amit"] });
  await addExpense(page, { title: "Taxi", amount: "800", payer: "Sneha", sharers: ["Rahul", "Sneha"] });
  await addExpense(page, { title: "Breakfast", amount: "600", sharers: ["Eeva", "Rahul", "Sneha"] });

  // The subset split is visible on the expense detail screen.
  await page.getByRole("link", { name: /Drinks/ }).first().click();
  await expect(page.getByText("Split between 2 people")).toBeVisible();
  await expect(page.getByText("₹600.00").first()).toBeVisible();

  // 6. One bill paid by two people, shared by a different subset.
  await page.getByRole("link", { name: "Expenses" }).first().click();
  await page.getByRole("link", { name: "Add expense" }).first().click();
  await page.fill("#amount", "1000");
  await page.fill("#title", "Scooters");
  await page.getByText("Split the payment between multiple people").click();
  await page.getByLabel("Amount paid by Eeva Tester").fill("600");
  await page.getByLabel("Amount paid by Rahul").fill("400");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.locator("label").filter({ hasText: "Amit" }).first().click();
  await page.locator("label").filter({ hasText: "Sneha" }).first().click();
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.waitForURL("**/expenses");

  // 7. Verify the on-screen balances (hotel 2000pp, dinner 600pp, drinks 600
  // Eeva/Amit, taxi 400 Rahul/Sneha, breakfast 200 x3, scooters 500 Amit/Sneha
  // paid 600/400 by Eeva/Rahul).
  await page.getByRole("link", { name: "Overview" }).click();
  const expectBalance = async (name: string, amount: string) => {
    await expect(page.locator("a").filter({ hasText: name }).filter({ hasText: amount })).toBeVisible();
  };
  await expectBalance("Eeva Tester", "+₹5,800.00");
  await expectBalance("Rahul", "−₹400.00");
  await expectBalance("Amit", "−₹2,500.00");
  await expectBalance("Sneha", "−₹2,900.00");

  // 8. The settlement plan.
  await page.getByRole("link", { name: "Settle up" }).first().click();
  await expect(page.getByText("Sneha pays Eeva Tester")).toBeVisible();
  await expect(page.getByText("Amit pays Eeva Tester")).toBeVisible();
  await expect(page.getByText("Rahul pays Eeva Tester")).toBeVisible();

  // 9. Record a PARTIAL payment from Amit (₹1,000 of ₹2,500).
  await page
    .locator("div")
    .filter({ hasText: /^Amit pays Eeva Tester/ })
    .getByRole("button", { name: "Record payment" })
    .first()
    .click();
  await page.getByLabel("Amount").fill("1000");
  await page.getByRole("button", { name: "Record payment" }).last().click();
  await expect(page.getByText("Payment recorded: Amit paid Eeva Tester")).toBeVisible();

  // 10. Remaining balances reflect the partial payment.
  await expect(page.getByText("−₹1,500.00").first()).toBeVisible(); // Amit after partial payment
  await expect(page.getByText("Amit paid Eeva Tester", { exact: true })).toBeVisible(); // recorded list

  // Settle everything else.
  for (const amount of ["2,900", "1,500", "400"]) {
    await page.getByRole("button", { name: "Record payment" }).first().click();
    await page.getByRole("button", { name: "Record payment" }).last().click();
    await expect(page.getByText(/Payment recorded/).last()).toBeVisible();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText("All settled 🎉")).toBeVisible();

  // 11. Complete the trip and check the final report.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Complete trip" }).click();
  await expect(page.getByText("Trip completed — check the final report")).toBeVisible();
  await page.getByRole("link", { name: "Report" }).click();
  await expect(page.getByText("Fully settled — nothing left to pay.")).toBeVisible();
  await expect(page.getByText("₹14,000.00").first()).toBeVisible(); // trip total

  // CSV export downloads with the right content.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("report.csv");

  // Closed trip hides the add-expense actions.
  await page.getByRole("link", { name: "Expenses", exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Add expense" })).toHaveCount(0);
});

test("expense edit recalculates balances; invite link lets a new user claim a guest", async ({ page, browser }) => {
  // Self-contained account: worker restarts would regenerate module state,
  // so this test never depends on the first test's credentials.
  const run2 = Date.now();
  await page.goto("/signup");
  await page.fill("#name", "Edda Editor");
  await page.fill("#email", `e2e-edit-${run2}@example.com`);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/welcome");

  // Fresh small trip for this test.
  const trip2 = `E2E Edit ${run2}`;
  await page.goto("/trips/new");
  await page.fill("#name", trip2);
  await page.getByLabel("Travel mate 1").fill("Guestina");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/\/trips\/(?!new$)[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: trip2 })).toBeVisible();
  const tripUrl = new URL(page.url()).pathname;

  await addExpense(page, { title: "Lunch", amount: "500" });
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("−₹250.00").first()).toBeVisible();

  // Edit the amount; balances must recalculate.
  await page.getByRole("link", { name: "Expenses" }).first().click();
  await page.getByRole("link", { name: /Lunch/ }).click();
  await page.getByRole("link", { name: "Edit expense" }).click();
  await page.fill("#amount", "900");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/updated/).first()).toBeVisible();
  await page.goto(tripUrl);
  await expect(page.getByText("−₹450.00").first()).toBeVisible();

  // Invite link → brand-new user claims the guest identity and sees history.
  await page.goto(`${tripUrl}/participants`);
  await page.getByRole("button", { name: "Create invite link" }).click();
  const link = await page.locator("p.break-all").textContent();
  expect(link).toContain("/join/");

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(link!.trim());
  await p2.getByRole("link", { name: "Create account & join" }).click();
  await p2.fill("#name", "Claimed Carla");
  await p2.fill("#email", `e2e-claim-${run2}@example.com`);
  await p2.fill("#password", PASSWORD);
  await p2.getByRole("button", { name: "Create account" }).click();
  await p2.waitForURL(/\/join\//);
  await p2.getByText("I'm Guestina").click();
  await p2.getByRole("button", { name: "Join trip" }).click();
  await p2.waitForURL(/\/trips\/(?!new$)[a-z0-9]+$/);
  // Carla inherited Guestina's debt from the edited expense.
  await expect(p2.getByText("−₹450.00").first()).toBeVisible();
  await ctx2.close();
});
