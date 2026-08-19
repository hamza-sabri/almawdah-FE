import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

import { badgeLabels } from "@/lib/print/receipt"

/**
 * Reprinting a past version of a corrected sale.
 *
 * The receipt code identifies the SALE, not the version, so every version
 * prints the same barcode — scanning any piece of paper from this sale has to
 * land on this sale. That is correct, and it is also the danger: two receipts,
 * one number, different totals. The only thing separating them is what the
 * paper says about itself.
 */
const SRC = readFileSync(
  path.resolve(__dirname, "sale-revisions.tsx"),
  "utf8",
)
const CANVAS = readFileSync(
  path.resolve(__dirname, "../../lib/print/receipt-canvas.ts"),
  "utf8",
)

describe("the version marker", () => {
  it("is printed whenever a version label is set", () => {
    expect(badgeLabels({ versionLabel: "نسخة سابقة 2" })).toEqual([
      "نسخة سابقة 2",
    ])
  })

  it("is absent on an ordinary receipt", () => {
    expect(badgeLabels({})).toEqual([])
  })

  it("does not displace the return marker — a return can be corrected too", () => {
    expect(badgeLabels({ isReturn: true, versionLabel: "نسخة سابقة 3" })).toEqual([
      "فاتورة إرجاع",
      "نسخة سابقة 3",
    ])
  })

  it("reaches the THERMAL raster, not just the HTML", () => {
    // The raster is the copy that actually reaches a customer. A marker on
    // only one of the two renderers is worse than none.
    expect(CANVAS).toContain("badgeLabels(data)")
    expect(CANVAS).toContain("for (const label of badges)")
  })

  it("is counted when sizing the canvas", () => {
    // An under-tall canvas silently clips the bottom of the receipt — the
    // barcode is the last thing on it.
    expect(CANVAS).toContain("h += badges.length * S(44)")
    expect(CANVAS).toContain("h += meta.length * S(28)")
  })
})

describe("reprinting a version", () => {
  it("keeps the SALE's barcode, not a per-version one", () => {
    expect(SRC).toContain("receiptCode: receiptCode || snap.receipt_code")
  })

  it("labels which version it is", () => {
    expect(SRC).toContain("versionLabel:")
    expect(SRC).toContain("نسخة سابقة — الأصلية")
    expect(SRC).toContain("`نسخة سابقة ${rev.version}`")
  })

  it("prints the SNAPSHOT's lines and totals, not today's", () => {
    expect(SRC).toContain("snap.items.map")
    expect(SRC).toContain("toNumber(snap.total)")
    expect(SRC).toContain("toNumber(snap.discounted_total)")
  })

  it("dates the paper when the sale was rung, not when it was corrected", () => {
    // The version's own header already says who changed it and when; the
    // receipt is a record of the transaction.
    expect(SRC).toContain("createdAt: snap.created_at")
  })

  it("goes out the same door as every other print", () => {
    expect(SRC).toContain("deliverAndToast(")
    expect(SRC).not.toMatch(/(?<!\w)printReceipt\s*\(/)
  })
})
