import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests against a LOCAL FULL STACK:
 *   - Django backend on :8000, a throwaway SQLite DB seeded with the `demo`
 *     tenant (login demo/demo, 40 known products) — booted by e2e/run-backend.sh
 *   - the Next.js app on :3000, pointed at that backend.
 *
 * Both servers are started automatically by the `webServer` block below, so the
 * whole suite runs with a single command: `npm run test:e2e`.
 *
 * The backend lives in a sibling repo (../alrahmah). Override with BACKEND_DIR
 * if your layout differs.
 */

const FRONTEND_URL = "http://127.0.0.1:3000"
const BACKEND_URL = "http://127.0.0.1:8000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one seeded DB → keep write-tests deterministic/ordered
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ar",
  },

  projects: [
    // 1) Log in once as the demo owner and save the session for every test.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/owner.json" },
      dependencies: ["setup"],
    },
    // Mobile viewport — the POS + nav are used heavily on phones.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/owner.json" },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      command: "bash e2e/run-backend.sh",
      url: `${BACKEND_URL}/healthz/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Production build + start — avoids the Turbopack dev-bundler entirely
      // (which panics intermittently) and is deterministic for tests.
      // NEXT_PUBLIC_* are inlined at build time, so they go on the build.
      // For fast local iteration you can instead run `pnpm dev` in another
      // terminal — reuseExistingServer will attach to it and skip the build.
      command:
        "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 " +
        "NEXT_PUBLIC_PHARMACY_SLUG=demo " +
        "NEXT_PUBLIC_SITE_MODE=store " +
        "pnpm exec next build && pnpm exec next start --port 3000",
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
})
