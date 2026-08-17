import { test as setup, expect } from "@playwright/test"

/**
 * Logs in once as the demo owner (demo/demo) and saves the browser session
 * (localStorage tokens) so every other test starts already authenticated —
 * fast, and the login flow itself is still covered by auth.spec.ts.
 */
const authFile = "e2e/.auth/owner.json"

setup("authenticate as demo owner", async ({ page }) => {
  await page.goto("/login")
  await page.locator("#username").fill("demo")
  await page.locator("#password").fill("demo")
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()

  // We should leave /login for an authenticated page.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  })
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(window.localStorage.getItem("alrahmah_access"))),
    )
    .toBe(true)

  await page.context().storageState({ path: authFile })
})
