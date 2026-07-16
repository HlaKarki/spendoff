import { expect, test } from "@playwright/test";

// Full-stack smoke: sign up via magic link, log an expense, see it confirmed. Catches the
// "entire app is white" / "signup is broken" class of failure that no unit test can. Requires the
// backend (:8787) and frontend (:3000) to be running; the frontend is booted by playwright.config.
test("sign up, log an expense, see it confirmed", async ({ page }) => {
  const email = `smoke-${Date.now()}@example.com`;

  // ── Sign up (magic link) ──────────────────────────────────────────────────
  await page.goto("/onboard");
  // Onboard defaults to "sign in"; switch to the create tab so the name field appears. The click
  // retries until the tab actually switches: the SSR'd button is visible before React hydrates,
  // and a click landing in that window is silently dead.
  await expect(async () => {
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByPlaceholder("e.g. Alex")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await page.getByPlaceholder("e.g. Alex").fill("Smoke Tester");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByRole("button", { name: "Email me a link instead" }).click();

  // In dev the magic link is surfaced in-page; redeem it.
  const devLink = page.getByRole("link", { name: /Open dev link/ });
  await expect(devLink).toBeVisible();
  await devLink.click();

  // Landing anywhere that isn't /onboard means the session took.
  await expect(page).not.toHaveURL(/\/onboard/, { timeout: 15_000 });

  // That redirect is client-side — it fires as soon as the verify response resolves, which can be
  // a moment before the browser has committed the Set-Cookie. The next line is a full navigation,
  // so it would send no session and bounce straight back to /onboard. Wait for the cookie itself
  // rather than for a duration: it's the actual thing being raced.
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === "so_session"), { timeout: 10_000 })
    .toBe(true);

  // ── Log an expense ────────────────────────────────────────────────────────
  // Counter IA: the register is the home screen now; /log only redirects here.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Log expense" })).toBeVisible();

  // Pick a category, then key in $5.00 (press 5, 0, 0 → cents 500).
  await page.getByRole("button", { name: "Food" }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await page.getByRole("button", { name: "0", exact: true }).click();
  await expect(page.getByText("$5.00")).toBeVisible();

  await page.getByRole("button", { name: "Log expense", exact: true }).click();

  // ── See it confirmed ──────────────────────────────────────────────────────
  // The save toast is the end-to-end proof: it only appears after logExpense → the backend sync
  // succeeded and the query cache was invalidated.
  await expect(page.getByText("Logged $5.00")).toBeVisible({ timeout: 10_000 });
});
