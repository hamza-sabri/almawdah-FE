import { test, expect } from "@playwright/test"

/**
 * Smoke coverage: every authenticated page must load with no server error, no
 * uncaught JS error, and no error-boundary — the widest, cheapest net that
 * catches "white screen" / crash regressions before a customer ever sees them.
 * Deeper per-flow assertions live in the feature specs (pos.spec.ts, …).
 */

const PAGES = [
  "/pos",
  "/inventory",
  "/inventory/stats",
  "/sales",
  "/debts",
  "/debts/stats",
  "/customers",
  "/purchases",
  "/reports",
  "/import",
  "/settings",
  "/guide",
]

for (const path of PAGES) {
  test(`loads without error: ${path}`, async ({ page }) => {
    const jsErrors: string[] = []
    page.on("pageerror", (e) => jsErrors.push(String(e.message ?? e)))

    const resp = await page.goto(path, { waitUntil: "domcontentloaded" })
    expect(resp?.status(), `HTTP status for ${path}`).toBeLessThan(400)

    // The app shell rendered (not a blank/crashed page).
    await expect(page.locator("main").first()).toBeVisible({ timeout: 12_000 })

    // No generic error-boundary fallback on screen.
    await expect(
      page.getByText(/حدث خطأ|Something went wrong|Application error/i),
    ).toHaveCount(0)

    expect(jsErrors, `uncaught JS errors on ${path}`).toEqual([])
  })
}

test("public price-check kiosk loads (no auth)", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  const jsErrors: string[] = []
  page.on("pageerror", (e) => jsErrors.push(String(e.message ?? e)))
  const resp = await page.goto("/price", { waitUntil: "domcontentloaded" })
  expect(resp?.status()).toBeLessThan(400)
  await expect(page.locator("main, body").first()).toBeVisible()
  expect(jsErrors).toEqual([])
  await ctx.close()
})
