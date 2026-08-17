import { describe, expect, it } from "vitest"

import { TOURS } from "@/lib/tour/tours"

/**
 * Every anchor a tour points at must exist somewhere in the app.
 *
 * The tour runner has no way to say "that anchor doesn't exist" — when it
 * can't find one it silently falls back to a full-screen centred card, which
 * looks like a styling bug rather than a broken step. `nav-products` was
 * dead for exactly this reason: the products page was renamed to inventory
 * and nothing failed.
 */
const KNOWN_NAV = ["pos", "inventory", "sales", "purchases", "debts", "customers", "reports", "import", "settings"]

describe("tour anchors", () => {
  it("never points at a nav item that does not exist", () => {
    const bad: string[] = []
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        const a = step.anchor
        if (typeof a === "string" && a.startsWith("nav-")) {
          const slug = a.slice("nav-".length)
          if (!KNOWN_NAV.includes(slug)) bad.push(`${tour.id}: ${a}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it("still routes the product tours at the renamed inventory page", () => {
    const ids = ["add-product", "edit-product"]
    for (const id of ids) {
      const tour = TOURS.find((t) => t.id === id)
      if (!tour) continue
      const anchors = tour.steps.map((s) => s.anchor)
      expect(anchors).not.toContain("nav-products")
    }
  })
})
