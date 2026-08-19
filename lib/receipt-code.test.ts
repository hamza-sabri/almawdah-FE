import { describe, it, expect } from "vitest"

import { newReceiptCode, isReceiptCode } from "@/lib/receipt-code"

/**
 * The barcode on the paper. The owner's problem is finding one sale among
 * 145,647 when a customer walks back in holding a receipt.
 */
describe("the receipt number", () => {
  it("is exactly twelve digits — Code 128 packs those two per symbol", () => {
    // An odd length would fall out of subset C and widen the barcode past a
    // 58mm roll.
    expect(newReceiptCode()).toMatch(/^[0-9]{12}$/)
  })

  it("starts with the date, so it is readable without a scanner", () => {
    const code = newReceiptCode(new Date(2026, 7, 19, 7, 7))
    expect(code.slice(0, 6)).toBe("260819")
  })

  it("pads single-digit months and days", () => {
    expect(newReceiptCode(new Date(2026, 0, 3)).slice(0, 6)).toBe("260103")
  })

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 500 }, () => newReceiptCode()))
    expect(codes.size).toBeGreaterThan(480)
  })

  it("recognises its own shape and rejects everything else", () => {
    expect(isReceiptCode(newReceiptCode())).toBe(true)
    for (const junk of ["", "12", "abcdefghijkl", "26081912345", "2608191234567", 260819123456, null])
      expect(isReceiptCode(junk)).toBe(false)
  })

  it("accepts a backfilled historical code — the same twelve digits", () => {
    // Sales imported from the old till are the zero-padded id.
    expect(isReceiptCode("000000145647")).toBe(true)
  })
})
