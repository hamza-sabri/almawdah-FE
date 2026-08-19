import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"

/**
 * One toast per checkout.
 *
 * A sale used to raise two: "تم البيع — ₪163.00" and, a beat later, a second
 * about the receipt. Two stacked toasts for one action read as two things
 * having happened, and the cashier has to parse both while a customer waits.
 *
 * These assert the source, because the alternative is mounting the whole POS.
 * They are cheap and they pin the exact properties that regressed.
 */
const SRC = readFileSync("app/(app)/pos/page.tsx", "utf8")
const FN = SRC.slice(
  SRC.indexOf("function printAndAnnounce("),
  SRC.indexOf("\nfunction", SRC.indexOf("function printAndAnnounce(") + 10),
)

describe("the checkout toast", () => {
  it("is keyed, so the print result updates it instead of stacking", () => {
    expect(SRC).toContain("const toastId = `sale-")
    // Every toast in the flow carries the id.
    const calls = FN.match(/toast\.(success|warning|error)\(|show\(/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const m of FN.matchAll(/(?:show|toast\.\w+)\(\s*headline,\s*\{([^}]*)\}/g)) {
      expect(m[1]).toContain("id")
    }
  })

  it("keys on the receipt code — stable across a retry of the same cart", () => {
    expect(SRC).toContain("snapshot.receiptCode")
  })

  it("never leaves a toast up longer than 7 seconds", () => {
    // The previous 10-12s ones were still on screen for the next customer.
    const durations = [...SRC.matchAll(/duration:\s*([0-9_]+)/g)].map((m) =>
      Number(m[1].replace(/_/g, "")),
    )
    expect(durations.length).toBeGreaterThan(0)
    for (const d of durations) expect(d).toBeLessThanOrEqual(7000)
  })

  it("says what happened to the receipt in the SAME box, as a description", () => {
    expect(FN).toContain("طُبعت الفاتورة")
    expect(FN).toContain("نُزّلت الفاتورة")
  })

  it("keeps the sale's own wording as the headline in every outcome", () => {
    // The amount is the thing the cashier is checking; printing is a footnote
    // to it, never a replacement for it.
    const shows = [...FN.matchAll(/(?:show|toast\.warning)\(\s*(\w+)/g)].map((m) => m[1])
    expect(shows.length).toBeGreaterThanOrEqual(3)
    for (const arg of shows) expect(arg).toBe("headline")
  })

  it("only the no-printer case is a warning; a normal print is not", () => {
    expect(FN).toContain('case "agent":')
    expect(FN).toContain("toast.warning(headline")
  })
})
