import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke tests. Separate from the vitest unit/integration suite (src/**/*.test.ts) — this
// drives a real browser against the running app.
//
// Requires the BACKEND on :8787 (a separate repo, hla-backend). The frontend is booted below.
// Run with: bun run test:e2e
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
