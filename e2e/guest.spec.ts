import { expect, test } from "@playwright/test";

// Guest path: try the app from the landing with no account, hit the battles gate, then save the
// ledger with an account and see the guest's expense still there. Needs the backend on :8787.
test("start as a guest, log, then keep the ledger by creating an account", async ({ page }) => {
  const email = `guest-${Date.now()}@example.com`;

  await page.goto("/");
  // The SSR'd button is visible before React hydrates, so retry until the click actually lands.
  await expect(async () => {
    await page.getByRole("button", { name: "Start free" }).first().click();
    await expect(page.getByRole("button", { name: "Log expense" })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByText(/Guest ledger · kept until/)).toBeVisible();

  await page.getByRole("button", { name: "Food" }).click();
  await page.getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "Log expense", exact: true }).click();
  await expect(page.getByText("Logged $4.20")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Battles" }).click();
  await page
    .getByRole("button", { name: /Create/ })
    .first()
    .click();
  await expect(page.getByText("Battles need an account")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create battle" })).toHaveCount(0);

  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page.getByText("Your guest ledger comes with you.", { exact: false })).toBeVisible();
  await page.getByPlaceholder("e.g. Alex").fill("Guest Tester");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByRole("button", { name: "Email me a link instead" }).click();

  const devLink = page.getByRole("link", { name: /Open dev link/ });
  await expect(devLink).toBeVisible();
  await devLink.click();
  await expect(page).not.toHaveURL(/\/(onboard|auth)/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText(/Guest ledger/)).toHaveCount(0);
  await expect(page.getByText("$4.20").first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText(email)).toBeVisible();
});
