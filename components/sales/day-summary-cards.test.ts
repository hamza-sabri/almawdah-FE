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
    expect(CARD).toContain("salesDaySummary(params)")
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
    // NOT "مبيعات اليوم": the same card now shows a week, a month or a
    // hand-picked range, and a label saying "اليوم" over a month's takings is
    // a number the owner would misread.
    expect(CARD).toContain('label="إجمالي المبيعات"')
    expect(CARD).not.toContain("إجمالي مبيعات اليوم")
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

describe("the period filter", () => {
  it("offers day, week and month", () => {
    expect(CARD).toContain('{ key: "day", label: "اليوم" }')
    expect(CARD).toContain('{ key: "week"')
    expect(CARD).toContain('{ key: "month"')
  })

  it("offers a hand-picked range as ONE field", () => {
    // Two native date boxes let a cashier set an end before a start, or set
    // one and wonder why nothing changed — and they render in the browser's
    // locale rather than the shop's.
    expect(CARD).toContain("<DateRangePicker")
    expect(CARD).not.toContain('type="date"')
  })

  it("only applies a range once BOTH ends are set", () => {
    // A half-filled picker would silently fall back to "today" while the
    // inputs on screen said otherwise.
    expect(CARD).toContain("const ranged = Boolean(from && to)")
  })

  it("keeps each window's figures under their own cache key", () => {
    expect(CARD).toContain('queryKey: ["sales-day-summary", ranged ? `${from}:${to}` : period]')
  })

  it("labels the figures with the window the SERVER reports", () => {
    // Not with the chip that happens to be selected — those disagree for the
    // moment between a click and the response landing.
    expect(CARD).toContain("windowLabel(data.period, data.cutover_hour)")
  })
})

describe("the range picker itself", () => {
  const PICKER = readFileSync(
    path.resolve(__dirname, "../ui/date-range-picker.tsx"),
    "utf8",
  )

  it("reports a range only once BOTH ends are chosen", () => {
    // A half-made range must never be mistaken for a filter.
    expect(PICKER).toContain("if (!anchor) {")
    expect(PICKER).toContain("onChange({ from, to })")
  })

  it("reads a backwards pick the way round it was plainly meant", () => {
    expect(PICKER).toContain("anchor <= day ? [anchor, day] : [day, anchor]")
  })

  it("abandons a half-pick when the popover closes", () => {
    // Otherwise a dangling start silently changes what the next click means.
    expect(PICKER).toContain("if (!o) setAnchor(null)")
  })

  it("adds no date library — the RTL calendar is already here", () => {
    // The comment explains the choice; strip comments before judging imports.
    const code = PICKER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(code).not.toContain("react-day-picker")
    expect(code).toContain("AR_MONTHS")
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
