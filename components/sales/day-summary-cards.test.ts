import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The three numbers the owner opens the sales page for.
 *
 * جوال, دخان, and the day's total — for the TRADING day, which rolls over at
 * 4am rather than midnight. The shop is still selling at 1am and cashes up in
 * the morning, so a sale rung at 00:30 belongs to the day that is still
 * running; counting by calendar date would split one night's takings across
 * two figures and match the drawer in neither.
 */
const CARD = readFileSync(
  path.resolve(__dirname, "day-summary-cards.tsx"),
  "utf8",
)
const PAGE = readFileSync(
  path.resolve(__dirname, "../../app/(app)/sales/page.tsx"),
  "utf8",
)

describe("where the day boundary is decided", () => {
  it("comes from the server, never computed on the till", () => {
    // A till with a wrong clock or timezone would otherwise report a different
    // day than the owner's books, silently.
    expect(CARD).toContain("salesDaySummary()")
    expect(CARD).not.toMatch(/new Date\(/)
    expect(CARD).not.toContain("setHours")
  })

  it("shows the cashier which window the figures cover", () => {
    // "Since 4am" — otherwise a number that excludes last night reads as wrong.
    expect(CARD).toContain("data.cutover_hour")
    expect(CARD).toContain("منذ الساعة")
  })
})

describe("the cards", () => {
  it("renders every group the server sends, plus the total", () => {
    expect(CARD).toContain("data.groups.map")
    expect(CARD).toContain("إجمالي مبيعات اليوم")
  })

  it("does not hardcode which groups exist", () => {
    // The server owns the grouping; adding one there must not need a release
    // here. Only the icons are keyed by name, and they fall back.
    expect(CARD).toContain("ICONS[g.key] ?? Wallet")
    expect(CARD).not.toMatch(/groups\[0\]|groups\[1\]/)
  })

  it("refreshes on its own — the office screen stays open all day", () => {
    expect(CARD).toContain("refetchInterval")
  })
})

describe("the sales page", () => {
  it("puts the cards above everything else", () => {
    const cards = PAGE.indexOf("<DaySummaryCards />")
    const periods = PAGE.indexOf("{/* Period totals */}")
    expect(cards).toBeGreaterThan(-1)
    expect(cards).toBeLessThan(periods)
  })

  it("collapses the 30-day analytics the owner does not read", () => {
    // They pushed the numbers he DOES read below the fold.
    expect(PAGE).toContain("تحليلات آخر ٣٠ يوماً")
    expect(PAGE).toContain("<details className=\"group mb-5\">")
  })
})
