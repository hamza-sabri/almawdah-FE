import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

/**
 * Everything below asserts about the LIST — the long tail of unscannable
 * items. The quick cards used to render above it and repeated some of the same
 * names; they now live in the POS toolbar beside جوال (quick-cards.test.tsx),
 * but the scoping stays: it says which region each assertion means.
 */
function list() {
  return within(screen.getByRole("group", { name: "قائمة الأصناف بدون باركود" }))
}

import {
  QuickItemsPanel,
  isQuickItem,
} from "@/components/pos/quick-items-panel"

/**
 * The items that cannot be scanned.
 *
 * From the shop's own history: 196 of 2,398 products have no barcode, they
 * carry 26,240 sale lines (4.9% of every line ever rung), and they appear on
 * 1 in 8 receipts — سيجارة حلل, شحن رصيد, بيض. Loose goods and services.
 * Before this the cashier had to type an Arabic name to reach them.
 *
 * It reads the catalogue the POS already holds in the browser, so it works
 * offline with no endpoint at all.
 */
const CATALOG = [
  { id: 1, name: "سيجارة حلل", barcode: "", price: "2.00", stock: 0, category: "" },
  { id: 2, name: "شحن رصيد", barcode: "", price: "25.00", stock: 0, category: "" },
  { id: 3, name: "بيض", barcode: "", price: "12.00", stock: 0, category: "" },
  // has a barcode → scannable → not here
  { id: 4, name: "بندورة", barcode: "111", price: "7.00", stock: 5, category: "" },
  // no primary but HAS an extra → still scannable → not here
  { id: 5, name: "أرز", barcode: "", alt_barcodes: ["999"], price: "9.00", stock: 1, category: "" },
  // the old till's placeholder row — no name, no price, must never be tappable
  { id: 6, name: "0".repeat(50), barcode: "", price: "0.00", stock: 0, category: "" },
] as never[]

describe("which products count as quick items", () => {
  it("only those with no scannable code at all", () => {
    const names = CATALOG.filter(isQuickItem).map((m: never) => (m as { name: string }).name)
    expect(names).toEqual(["سيجارة حلل", "شحن رصيد", "بيض"])
  })

  it("a product with only an ALT barcode is scannable, so it is excluded", () => {
    expect(isQuickItem(CATALOG[4])).toBe(false)
  })
})

describe("the panel", () => {
  beforeEach(() => window.localStorage.clear())

  it("lists every unscannable item with its price", () => {
    render(<QuickItemsPanel catalog={CATALOG} onPick={vi.fn()} />)
    expect(list().getByText("سيجارة حلل")).toBeTruthy()
    expect(list().getByText("شحن رصيد")).toBeTruthy()
    expect(screen.queryByText("بندورة")).toBeNull() // scannable
  })

  it("one tap adds it to the cart", () => {
    const onPick = vi.fn()
    render(<QuickItemsPanel catalog={CATALOG} onPick={onPick} />)
    fireEvent.click(list().getByText("بيض"))
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "بيض" }),
    )
  })

  it("is searchable by name", () => {
    render(<QuickItemsPanel catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("ابحث في الأصناف بدون باركود"), {
      target: { value: "شحن" },
    })
    expect(list().getByText("شحن رصيد")).toBeTruthy()
    expect(list().queryByText("بيض")).toBeNull()
  })

  it("puts tobacco first, before anything else", () => {
    // The owner asked for it and the export agrees: سيجارة حلل alone is more
    // than half of every barcode-less sale line this shop has ever rung.
    render(<QuickItemsPanel catalog={CATALOG} onPick={vi.fn()} />)
    const rows = list().getAllByRole("button")
    expect(rows[0].textContent).toContain("سيجارة حلل")
  })

  it("floats the last-tapped item to the top of its group", () => {
    // The traffic is extremely concentrated, so after a shift the panel sorts
    // itself into this shop's real order — under the pinned tobacco.
    const { unmount } = render(
      <QuickItemsPanel catalog={CATALOG} onPick={vi.fn()} />,
    )
    fireEvent.click(list().getByText("بيض"))
    unmount()

    render(<QuickItemsPanel catalog={CATALOG} onPick={vi.fn()} />)
    const rows = list().getAllByRole("button")
    expect(rows[0].textContent).toContain("سيجارة حلل") // still pinned
    expect(rows[1].textContent).toContain("بيض")
  })

  it("never shows the old till's zero-name placeholder", () => {
    render(<QuickItemsPanel catalog={CATALOG} onPick={vi.fn()} />)
    expect(screen.queryByText("0".repeat(50))).toBeNull()
  })

  it("says so plainly when the shop has none", () => {
    render(<QuickItemsPanel catalog={[CATALOG[3]] as never[]} onPick={vi.fn()} />)
    expect(screen.getByText("لا توجد أصناف بدون باركود")).toBeTruthy()
  })

  it("survives a missing catalogue (first load / offline cold start)", () => {
    render(<QuickItemsPanel catalog={undefined} onPick={vi.fn()} />)
    expect(screen.getByText("لا توجد أصناف بدون باركود")).toBeTruthy()
  })
})
