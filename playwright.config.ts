import { defineConfig, devices } from "@playwright/test";

// E2E scope per AGENTS.md §16: the `/api/contacto` form flow (valid/invalid/reused/
// missing Cap token, SMTP failure handling) and keyboard/focus/screen-reader checks.
// Specs are added starting in the API-route/pages work unit; this config only wires
// the runner against a production-like preview build.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
