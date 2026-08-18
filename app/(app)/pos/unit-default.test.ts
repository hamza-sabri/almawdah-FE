import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * A product is always added to the cart as a single PIECE.
 *
 * The bug: scanning a ₪1 chocolate bar opened "اختر النوع" listing only
 * "عبوة ×24 — ₪24.00" (twice, because the import makes one variant per pack
 * BARCODE and this product had two). There was no way to say "just one", so
 * the sale stopped dead at the till.
 *
 * Every variant in this store is a PACK created by the Shamel import from its
 * secondary selling units — not a colour or a size. So the base product is
 * always a valid answer and is the right default; the pack is the exception,
 * reachable from the النوع column after the fact.
 */
const SRC = readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf8",
)

describe("the POS defaults to a single piece", () => {
  it("adding never opens the unit dialog", () => {
    // addMedOrPick must not set the picker — that was the blocking behaviour.
    const fn = SRC.slice(
      SRC.indexOf("function addMedOrPick"),
      SRC.indexOf("/** Camera scan"),
    )
    expect(fn).not.toContain("setVariantPicker")
    expect(fn).toContain("addWithFeedback(med)")
  })

  it("the unit picker offers قطعة as its first option", () => {
    const dialog = SRC.slice(SRC.indexOf("اختر النوع</DialogTitle>"))
    const piece = dialog.indexOf(">قطعة<")
    const packs = dialog.indexOf("variantPicker?.variants.map")
    expect(piece).toBeGreaterThan(-1)
    expect(piece).toBeLessThan(packs) // listed before the packs
  })

  it("switching a line's unit keeps the quantity, via setLineUnit", () => {
    expect(SRC).toContain("pos.setLineUnit(")
    const hook = readFileSync(
      path.resolve(__dirname, "../../../hooks/use-pos-carts.ts"),
      "utf8",
    )
    // It must patch the line in place — not remove and re-add, which would
    // reset the quantity to 1 and lose the cashier's work.
    const fn = hook.slice(hook.indexOf("const setLineUnit"))
    expect(fn).toContain("l.key === key")
    expect(fn).not.toContain("quantity: 1")
  })

  it("duplicate pack rows are collapsed before the cashier sees them", () => {
    // One variant per pack barcode means two barcodes for the same 24-pack
    // render as two identical choices.
    const fn = SRC.slice(SRC.indexOf("function openUnitPicker"))
    expect(fn).toContain("seen.has(k)")
  })

  it("the cart table has a النوع column", () => {
    expect(SRC).toContain(">النوع</TableHead>")
    expect(SRC).toContain("<UnitCell")
  })
})

describe("every barcode a product has is searchable, not just scannable", () => {
  it("the POS search box matches the extra codes too", () => {
    // The gap the shop hit: a code you can SCAN but cannot TYPE. Scanning
    // resolved the extras (byBarcode indexes them); the search box filtered
    // on `barcode` alone — so a code the scanner accepted returned nothing
    // when keyed in by hand, which is exactly when the sticker is torn.
    const fn = SRC.slice(SRC.indexOf("const matches = useMemo"))
    expect(fn).toContain("m.alt_barcodes")
  })
})

