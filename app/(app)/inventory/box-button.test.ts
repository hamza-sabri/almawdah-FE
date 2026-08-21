import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

/**
 * The box icon on a product card opens the form that holds boxes — plural.
 *
 * A product can come in several: a 24 and a 12, a different flavour, each with
 * its own barcode, price and piece count. The icon used to open a single-box
 * dialog, so adding a SECOND box meant leaving the card, opening the row menu,
 * and hunting through «الأنواع». The shortcut now goes where the work is.
 */
const PAGE = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")

describe("the box icon", () => {
  it("opens the multi-box form", () => {
    expect(PAGE).toContain("onBox={() => setToVariants(m)}")
  })

  it("says «العبوات» when the product already has one", () => {
    expect(PAGE).toContain('title={hasBox ? "تعديل العبوات" : "إضافة عبوة"}')
  })

  it("leaves no single-box dialog behind to drift out of step", () => {
    expect(PAGE).not.toContain("BoxDialog")
    expect(PAGE).not.toContain("setToBox")
    expect(
      existsSync(path.resolve(__dirname, "../../../components/inventory/box-dialog.tsx")),
    ).toBe(false)
  })

  it("still reaches the same form from the row menu", () => {
    // Two ways in, one form — the menu entry stays for discoverability.
    expect(PAGE).toContain("onClick: onVariants")
  })
})
