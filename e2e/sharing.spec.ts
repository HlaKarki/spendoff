import { type Browser, type Page, expect, test } from "@playwright/test";

// Per-battle log sharing (HLA-94), driven as two real users in two browser contexts.
//
// The invariant worth a real browser: a member's individual rows are readable by their battle ONLY
// while they've opted in, their notes never are, and revoking takes effect on the next read. Unit
// tests assert that against the API; this asserts it against what a person actually sees.

const SECRET_NOTE = "therapy copay";

async function signUp(browser: Browser, name: string, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto("/onboard");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByPlaceholder("e.g. Alex").fill(name);
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByRole("button", { name: "Email me a link instead" }).click();
  await page.getByRole("link", { name: /Open dev link/ }).click();

  await expect(page).not.toHaveURL(/\/onboard/, { timeout: 15_000 });
  // The redirect is client-side and can beat the Set-Cookie; wait for the session itself, not a delay.
  await expect
    .poll(async () => (await ctx.cookies()).some((c) => c.name === "so_session"), { timeout: 10_000 })
    .toBe(true);

  return page;
}

// Logging through the UI can't attach a note in one step; the API can, and the httpOnly session
// cookie rides along from inside the page. The note is the point of the test, not the typing.
async function logSpendWithNote(page: Page, amountCents: number, note: string) {
  const res = await page.evaluate(
    async ([cents, n]) => {
      const r = await fetch("/api/v1/spendoff/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount_cents: cents,
          category_id: "food",
          note: n,
          spent_at: new Date().toISOString(),
        }),
      });
      return r.status;
    },
    [amountCents, note] as const,
  );
  expect(res).toBe(200);
}

const toggle = (page: Page) => page.getByRole("button", { name: /Share my log with this battle/ });

test("a battle member's log is private by default, shareable, note-free, and revocable", async ({ browser }) => {
  const stamp = Date.now();
  const alice = await signUp(browser, "Alice", `alice-${stamp}@example.com`);
  const bob = await signUp(browser, "Bob", `bob-${stamp}@example.com`);

  // ── Alice opens a battle, Bob joins it ────────────────────────────────────
  await alice.goto("/battles");
  await alice.getByRole("button", { name: "Create" }).click();
  await alice.getByPlaceholder("Sibling Showdown").fill("Sharing Test");
  await alice.getByRole("button", { name: "Create battle" }).click();
  await alice.waitForURL(/\/battles\/[^/]+$/, { timeout: 10_000 });

  const battleUrl = alice.url();
  const code = (await alice.locator(".font-mono").first().innerText()).trim();

  await bob.goto("/battles");
  await bob.getByRole("button", { name: "Join" }).click();
  await bob.getByPlaceholder("ABC1234").fill(code);
  await bob.getByRole("button", { name: "Join battle" }).click();
  await bob.waitForURL(/\/battles\/[^/]+$/, { timeout: 10_000 });

  await logSpendWithNote(bob, 4200, SECRET_NOTE);

  // ── Private by default ────────────────────────────────────────────────────
  await alice.goto(battleUrl);
  await expect(alice.getByText("Log private")).toBeVisible();
  await expect(alice.getByText("View log")).toHaveCount(0);

  // Bob's spend IS in the standings — that's the game. The note behind it is not, and never was:
  // the biggest-splurge callout is labelled by category.
  await expect(alice.locator("body")).not.toContainText(SECRET_NOTE);

  // ── Bob opts in ───────────────────────────────────────────────────────────
  await bob.goto(battleUrl);
  await toggle(bob).click();
  await expect(bob.getByText("Players here can see what you spent on")).toBeVisible({ timeout: 10_000 });

  // ── Alice can read the log — the amounts, not the note ────────────────────
  await alice.reload();
  await alice.getByText("View log").click();

  // Wait on something only the member page has. The router pushes the URL synchronously, so matching
  // on the URL (or on text the battle page also shows) would assert against the page we just left.
  await expect(alice.getByRole("heading", { name: "Bob", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(alice.getByText("Invite code")).toHaveCount(0);

  await expect(alice.getByText("Food")).toBeVisible();
  await expect(alice.getByText("$42.00").first()).toBeVisible();
  await expect(alice.locator("body")).not.toContainText(SECRET_NOTE);

  // ── Revocation lands on the next read ─────────────────────────────────────
  await bob.reload();
  await toggle(bob).click();
  await expect(bob.getByText("Off. Only your totals")).toBeVisible({ timeout: 10_000 });

  await alice.reload();
  await expect(alice.getByText(/keeps their log private/)).toBeVisible({ timeout: 10_000 });
  await expect(alice.locator("body")).not.toContainText("$42.00");
});
