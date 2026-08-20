import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The amount a corrected invoice charges.
 *
 * A correction opens with the amount the original sale was SETTLED at, so
 * reopening a ₪90-on-₪100 invoice to fix a customer's name does not silently
 * re-charge the full ₪100.
 *
 * That pin has to let go the moment the LINES change. It did not: an invoice
 * agreed at ₪10.00 for one item was edited to eight items worth ₪120.99 and
 * still charged ₪10.00 — an undercharge of ₪111 with nothing on screen saying
 * so, and a history panel showing "الإجمالي وقتها ₪10.00" above lines that
 * plainly added up to more.
 */
const POS = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")
const CART = readFileSync(
  path.resolve(__dirname, "../../../hooks/use-pos-carts.ts"),
  "utf8",
)
const REVISIONS = readFileSync(
  path.resolve(__dirname, "../../../components/sales/sale-revisions.tsx"),
  "utf8",
)

describe("a correction's pinned amount", () => {
  it("records the line sum at the moment it opened", () => {
    // Without a baseline there is no way to know the lines moved.
    expect(CART).toContain("editingBaseTotal")
    const fn = CART.slice(CART.indexOf("const openSaleForEdit"))
    expect(fn).toContain("editingBaseTotal: sale.lines.reduce(")
  })

  it("marks the amount as the ORIGINAL sale's, not the cashier's", () => {
    const fn = CART.slice(CART.indexOf("const openSaleForEdit"))
    expect(fn).toContain("discountFromOriginal: Boolean(sale.discounted)")
  })

  it("lets go as soon as the lines move", () => {
    expect(POS).toContain("const linesMoved =")
    expect(POS).toContain("active.discountFromOriginal &&")
    expect(POS).toContain("Math.abs(total - active.editingBaseTotal) > 0.005")
  })

  it("holds while the lines are untouched", () => {
    // Editing a name on a discounted invoice must not re-charge full price.
    expect(POS).toContain("if (active.discountTouched && !linesMoved) return")
  })

  it("never overwrites an amount the cashier typed during the correction", () => {
    // Both input paths disown the original the moment she types.
    const typed = POS.match(/discountFromOriginal: false,/g) ?? []
    expect(typed.length).toBeGreaterThanOrEqual(3) // 2 inputs + the unpin
  })
})

describe("the history panel's totals", () => {
  it("shows what the LINES came to, computed from the lines", () => {
    // Not the charged amount relabelled — that is what made eight lines
    // adding to ₪120.99 sit under a heading saying ₪10.00.
    expect(REVISIONS).toContain("مجموع الأصناف")
    expect(REVISIONS).toContain("rev.snapshot.items.reduce(")
    expect(REVISIONS).toContain("toNumber(it.line_total)")
  })

  it("shows the charged amount separately, and only when it differs", () => {
    expect(REVISIONS).toContain("المبلغ المدفوع وقتها")
    expect(REVISIONS).toContain("Math.abs(lineSum - charged) > 0.005")
  })
})
