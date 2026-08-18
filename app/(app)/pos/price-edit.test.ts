import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Editing money at the till, and being able to see it afterwards.
 *
 * The cashier negotiates out loud — "make it 10 for the two" — so both the
 * LINE total and the SALE total have to be typeable where they are read. The
 * part that is easy to get wrong is the record: `unit_price` alone cannot
 * distinguish "sold at ₪1 because that is the price" from "sold at ₪1 because
 * the cashier decided so". The catalogue price has to travel with the sale.
 */
const POS = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")
const CART = readFileSync(
  path.resolve(__dirname, "../../../hooks/use-pos-carts.ts"),
  "utf8",
)

describe("editing a line total", () => {
  it("derives the unit price from the total the cashier typed", () => {
    const fn = CART.slice(CART.indexOf("const setLineTotal"))
    expect(fn).toContain("lineTotal / qty")
  })

  it("holds the quantity — editing money must not change how many", () => {
    const fn = CART.slice(
      CART.indexOf("const setLineTotal"),
      CART.indexOf("const setQuantity"),
    )
    expect(fn).not.toContain("quantity:")
  })

  it("keeps basePrice untouched — it is the evidence of the override", () => {
    const fn = CART.slice(
      CART.indexOf("const setLineTotal"),
      CART.indexOf("const setQuantity"),
    )
    expect(fn).not.toContain("basePrice:")
  })
})

describe("what reaches the sale", () => {
  it("sends original_unit_price only when it actually differs", () => {
    const fn = POS.slice(POS.indexOf("function buildPayload"))
    expect(fn).toContain("original_unit_price")
    expect(fn).toContain("toNumber(l.basePrice) !== toNumber(l.unitPrice)")
  })

  it("records the catalogue price on every line as it is added", () => {
    expect(CART).toMatch(/basePrice: variant \? String\(variant\.price\)/)
  })

  it("re-bases the price when the unit changes", () => {
    // A box charged at the box's own list price is not an overridden piece.
    const fn = CART.slice(
      CART.indexOf("const setLineUnit"),
      CART.indexOf("const setLinePrice"),
    )
    expect(fn).toContain("basePrice:")
  })
})

describe("editing the sale total", () => {
  it("writes the cart's discounted total, which the sale already stores", () => {
    const fn = POS.slice(POS.indexOf("function TotalRow"))
    expect(fn).toContain("discountTouched: true")
    expect(fn).toContain("<MoneyEditor")
  })

  it("still shows the original total struck through", () => {
    const fn = POS.slice(POS.indexOf("function TotalRow"))
    expect(fn).toContain("line-through")
  })
})

describe("the money field refuses nonsense", () => {
  it("filters input with the same rule as the quantity field", () => {
    const fn = POS.slice(POS.indexOf("function MoneyEditor"))
    expect(fn).toContain("sanitizeQtyInput")
  })

  it("reverts rather than committing an unparsable value", () => {
    const fn = POS.slice(POS.indexOf("function MoneyEditor"))
    expect(fn).toContain("setText(value.toFixed(2))")
  })

  it("refuses a negative amount", () => {
    const fn = POS.slice(POS.indexOf("function MoneyEditor"))
    expect(fn).toContain("n < 0")
  })
})
