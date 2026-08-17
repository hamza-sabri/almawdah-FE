import { test, expect } from "@playwright/test"

/**
 * THE money path: a cash sale. If this breaks the store cannot take money,
 * so it's the single most important test. Uses the seeded product
 * "بنادول أقراص" (barcode 6001082000019, price 12.00).
 *
 * NOTE: the add-to-cart interaction is the one thing to confirm on the first
 * local run — if search shows a dropdown vs an inline list, adjust the click
 * selector below. Everything else is stable.
 */
test("cash sale: add a product and complete checkout", async ({ page }) => {
  await page.goto("/pos")
  await expect(page.locator("main").first()).toBeVisible()

  // Search for a known seeded product and add it to the cart.
  await page.getByPlaceholder(/ابحث/).fill("بنادول أقراص")
  await page.getByText("بنادول أقراص").first().click()

  // It's in the cart with its price, and the total is shown.
  await expect(page.getByText(/الإجمالي/)).toBeVisible()
  await expect(page.getByText("12.00").first()).toBeVisible({ timeout: 10_000 })

  // Cash is the default payment — complete the sale.
  await page.getByRole("button", { name: /إتمام البيع/ }).click()

  // Success confirmation toast.
  await expect(page.getByText(/تم البيع|تم\b/).first()).toBeVisible({
    timeout: 15_000,
  })
})
