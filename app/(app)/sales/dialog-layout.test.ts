import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The invoice dialog's header must not be squeezable.
 *
 * The dialog is a flex column with a max height. Expanding the revision
 * history grew the middle section, and because the header was a flex child
 * with no `shrink-0` it collapsed — hiding قيمة البيع, which is the one number
 * an owner opens an invoice to read. Only the middle may give.
 */
const SRC = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8")

describe("the invoice dialog", () => {
  it("pins the header so a growing body cannot crush it", () => {
    expect(SRC).toContain('className="ink-panel shrink-0 rounded-none p-6"')
  })

  it("pins the footer too — print and edit must stay reachable", () => {
    expect(SRC).toContain("flex shrink-0 flex-row items-center justify-between")
  })

  it("leaves the middle as the only section that scrolls", () => {
    expect(SRC).toContain("min-h-0 flex-1 space-y-4 overflow-y-auto p-6")
  })
})
