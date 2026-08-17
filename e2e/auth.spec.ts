import { test, expect } from "@playwright/test"

// This suite tests the login flow itself, so it starts UNauthenticated.
test.use({ storageState: { cookies: [], origins: [] } })

test("wrong password is rejected and stays on /login", async ({ page }) => {
  await page.goto("/login")
  await page.locator("#username").fill("demo")
  await page.locator("#password").fill("definitely-wrong")
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText(/تعذر|غير صحيحة|تحقق/)).toBeVisible({ timeout: 10_000 })
})

test("valid credentials log in and reach the app", async ({ page }) => {
  await page.goto("/login")
  await page.locator("#username").fill("demo")
  await page.locator("#password").fill("demo")
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 })
  await expect(page.locator("main").first()).toBeVisible()
})

test("app pages are protected when logged out", async ({ page }) => {
  await page.goto("/reports")
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
})
