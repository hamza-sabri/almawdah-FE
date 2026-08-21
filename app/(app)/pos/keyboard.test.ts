import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The till is worked from a keyboard and a barcode gun, not a mouse.
 *
 * Three things the cashier does constantly, each of which used to fail:
 *
 *   Type a haggled price, hit Enter. The amount used to be committed only by
 *   the BLUR handler, so whether it survived depended on the order two
 *   handlers happened to run in — she could ring the OLD price with the new
 *   one still on screen.
 *
 *   Scan an item, press + to make it two. The page-level +/− handler bails out
 *   the moment any field has focus — and a scan focuses the quantity field, so
 *   + did nothing at exactly the moment it was wanted.
 *
 *   F2 to finish AND print. A function key, so unlike Enter it is unambiguous
 *   mid-typing; it is handled once, globally.
 */
const POS = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")
const SCANNER = readFileSync(
  path.resolve(__dirname, "../../../hooks/use-global-scanner.ts"),
  "utf8",
)

describe("Enter banks what is typed before it finishes the sale", () => {
  it("commits the amount itself rather than relying on blur", () => {
    expect(POS).toContain("function commitThen(")
    expect(POS).toContain("commitThen(onSubmitSale)")
  })

  it("hands the submitter to BOTH money editors", () => {
    // The line total in the table, and the sale total beside الإجمالي.
    const uses = POS.match(/onSubmitSale=\{onSubmitSale\}/g) ?? []
    expect(uses.length).toBeGreaterThanOrEqual(2)
  })

  it("still commits the quantity before submitting", () => {
    const fn = POS.slice(POS.indexOf("export function QtyEditor"))
    const enter = fn.slice(fn.indexOf('if (e.key === "Enter")'))
    // The scan-burst branch comes first; the human-Enter branch commits.
    const human = enter.slice(0, enter.indexOf("if (e.key.length === 1)"))
    expect(human).toContain("commit()")
    expect(human).toContain("onSubmitSale?.()")
  })
})

describe("+ and − adjust the line that was just scanned", () => {
  it("are handled inside the quantity field, where focus actually is", () => {
    const fn = POS.slice(POS.indexOf("export function QtyEditor"))
    expect(fn).toContain('if (e.key === "+" || e.key === "-")')
    expect(fn).toContain('e.key === "+" ? 1 : -1')
  })

  it("never take a quantity below zero", () => {
    const fn = POS.slice(POS.indexOf("export function QtyEditor"))
    expect(fn).toContain("Math.max(0, roundQty(from + (e.key")
  })

  it("still work with nothing focused, via the page handler", () => {
    expect(SCANNER).toContain('if (e.key === "+" || e.code === "NumpadAdd")')
    expect(POS).toContain("onAdjustQty:")
  })
})

describe("F2 finishes the sale and prints it", () => {
  it("is handled BEFORE the focused-field bail-out", () => {
    // Otherwise it would be swallowed exactly when the cashier is mid-edit.
    const bail = SCANNER.indexOf("if (isEditable(document.activeElement))")
    const f2 = SCANNER.indexOf('if (e.key === "F2")')
    expect(f2).toBeGreaterThan(-1)
    expect(f2).toBeLessThan(bail)
  })

  it("is wired to a checkout that forces printing", () => {
    expect(POS).toContain("const printActiveSale = () => submitActiveSale(true)")
    expect(POS).toContain("onPrintSale: printActiveSale")
  })

  it("lets the editors bank their text first, without swallowing the key", () => {
    // The editors commit on F2 but must NOT preventDefault, or the global
    // handler never sees it and nothing prints.
    const qty = POS.slice(POS.indexOf("export function QtyEditor"))
    const start = qty.indexOf('if (e.key === "F2")')
    const f2 = qty.slice(start, qty.indexOf("return", start))
    // Comments explain the choice; strip them before judging the code.
    const code = f2.replace(/\/\/.*$/gm, "")
    expect(code).toContain("commit()")
    expect(code).not.toContain("preventDefault")
  })

  it("a bare Enter never forces a print", () => {
    // onEnter used to be passed the handler directly, so the KeyboardEvent
    // would have arrived as the forcePrint argument.
    expect(POS).toContain("onEnter: () => submitActiveSale(false)")
  })
})
