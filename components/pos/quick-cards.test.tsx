import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  render as rtlRender,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * The quick cards — the handful of things this shop sells constantly, one tap
 * from the counter.
 *
 * The layout lives on the STORE, not the browser: a cleared cache or a second
 * till must not lose how the shop arranged its own counter. So every test here
 * goes through the same GET/PUT the real component uses.
 */

const getQuickGroups = vi.fn()
const putQuickGroups = vi.fn()

vi.mock("@/api/quick-groups", () => ({
  getQuickGroups: (...a: unknown[]) => getQuickGroups(...a),
  putQuickGroups: (...a: unknown[]) => putQuickGroups(...a),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { QuickCards } from "@/components/pos/quick-cards"

function render(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

/**
 * A card's LABEL and a product's NAME are the same word on purpose — the بيض
 * card holds بيض. So every assertion below says which of the three regions it
 * means: the card row, the open card's options, or the add-item picker.
 */
const card = (key: string) => screen.getByTestId(`quick-card-${key}`)
/**
 * The button that OPENS the menu. A one-item card rings on tap instead, so its
 * menu lives behind the chevron; every other card is its own menu trigger.
 */
const menuOf = (key: string) =>
  screen.queryByTestId(`quick-card-${key}-menu`) ?? card(key)
const noCard = (key: string) => screen.queryByTestId(`quick-card-${key}`)
const options = () => within(screen.getByTestId("quick-card-options"))
const picker = () => within(screen.getByTestId("quick-card-picker"))
const ready = (key = "smoke") => screen.findByTestId(`quick-card-${key}`)

/** Real names from the shop's export, with their real line counts in mind. */
const CATALOG = [
  { id: 1, name: "سيجارة حلل", barcode: "", price: "2.00", stock: 0, category: "" },
  { id: 2, name: "دخان امبريال", barcode: "", price: "18.00", stock: 0, category: "" },
  { id: 3, name: "دخان عربي", barcode: "", price: "15.00", stock: 0, category: "" },
  { id: 4, name: "بيض", barcode: "", price: "12.00", stock: 0, category: "" },
  { id: 5, name: "شحن رصيد", barcode: "", price: "25.00", stock: 0, category: "" },
  // scannable — never a default card member, but the owner may still pin it
  { id: 6, name: "بندورة", barcode: "111222", price: "7.00", stock: 5, category: "" },
] as never[]

const savedLayout = (groups: unknown[]) =>
  getQuickGroups.mockImplementation(() => Promise.resolve({ data: { groups } }))

beforeEach(() => {
  vi.clearAllMocks()
  getQuickGroups.mockImplementation(() =>
    Promise.resolve({ data: { groups: [] } }),
  )
  putQuickGroups.mockImplementation((groups: unknown) =>
    Promise.resolve({ data: { groups } }),
  )
})

/** What the component actually PUT, first call. */
function sentGroups() {
  return putQuickGroups.mock.calls[0][0] as Array<{
    key: string
    product_ids: number[]
  }>
}

describe("the cards themselves", () => {
  it("offers no حلويات card — the owner did not ask for one", async () => {
    render(
      <QuickCards
        catalog={[
          ...CATALOG,
          { id: 8, name: "كيك شوكولا", barcode: "", price: "5.00", stock: 0, category: "" },
        ] as never[]}
        onPick={vi.fn()}
      />,
    )
    await ready()
    expect(noCard("sweets")).toBeNull()
    expect(screen.queryByText(/حلويات/)).toBeNull()
  })

  it("shows دخان and بيض on day one, with no saved layout", async () => {
    // The owner's complaint was literally "I don't see eggs and cigarettes" —
    // a shop that has configured nothing must still get useful cards.
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    expect(card("smoke").textContent).toContain("دخان")
    expect(card("eggs").textContent).toContain("بيض")
  })

  it("offers no شحن رصيد card — it is stored at a nominal ₪1", async () => {
    // A one-tap card would ring ₪1 instead of the ₪10–₪100 actually paid. The
    // جوال button above the cart asks the amount first; that is the only way
    // top-up should be reachable.
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    expect(noCard("topup")).toBeNull()
  })

  it("does not show وطنية — the owner asked for it gone", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    expect(screen.queryByText(/وطنية/)).toBeNull()
  })

  it("counts what is on each card", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    expect(card("smoke").textContent).toContain("3") // حلل + امبريال + عربي
  })

  it("keeps a scannable product off the DEFAULT cards", async () => {
    // بندورة is barcoded, so the gun already reaches it in one pull. A card
    // slot spent on it is a slot stolen from something that needs one.
    const smokeWithBarcode = [
      ...CATALOG,
      {
        id: 7,
        name: "دخان مارلبورو",
        barcode: "555",
        price: "22.00",
        stock: 3,
        category: "",
      },
    ] as never[]
    render(<QuickCards catalog={smokeWithBarcode} onPick={vi.fn()} />)
    fireEvent.click(await ready())
    expect(options().queryByText("دخان مارلبورو")).toBeNull()
  })

  it("caps a derived card at 12 — a shortcut with forty entries is a list", async () => {
    const many = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: 100 + i,
        name: `دخان ${i}`,
        barcode: "",
        price: "10.00",
        stock: 0,
        category: "",
      })),
    ] as never[]
    render(<QuickCards catalog={many} onPick={vi.fn()} />)
    expect((await ready()).textContent).toContain("12")
  })

  it("renders nothing at all when the shop matches no card", async () => {
    const { container } = render(
      <QuickCards catalog={[CATALOG[5]] as never[]} onPick={vi.fn()} />,
    )
    await waitFor(() => expect(getQuickGroups).toHaveBeenCalled())
    expect(container.textContent).toBe("")
  })

  it("survives a missing catalogue (offline cold start)", async () => {
    render(<QuickCards catalog={undefined} onPick={vi.fn()} />)
    await waitFor(() => expect(getQuickGroups).toHaveBeenCalled())
    expect(noCard("smoke")).toBeNull()
  })
})

describe("opening a card", () => {
  it("reveals its options, most-sold first", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready())
    // سيجارة حلل is 14,257 sale lines — more than half of every barcode-less
    // line this shop has ever rung. It leads.
    const rows = options().getAllByRole("menuitem")
    expect(rows[0].textContent).toContain("سيجارة حلل")
  })

  it("one tap on an option adds it to the cart", async () => {
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    fireEvent.click(await ready())
    fireEvent.click(options().getByText("دخان عربي"))
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "دخان عربي" }),
    )
  })

  it("closes itself after ringing an item — a menu left open hides the cart", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready())
    fireEvent.click(options().getByText("دخان عربي"))
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })

  it("closes on Escape", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    fireEvent.click(menuOf("eggs"))
    expect(screen.getByTestId("quick-card-options")).toBeTruthy()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })

  it("opening one card closes the other", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    fireEvent.click(menuOf("smoke"))
    expect(options().queryByText("سيجارة حلل")).toBeTruthy()
    fireEvent.click(menuOf("eggs"))
    expect(options().queryByText("سيجارة حلل")).toBeNull()
    expect(options().getByText("بيض")).toBeTruthy()
  })

  it("tapping the same card again closes it", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    fireEvent.click(menuOf("eggs"))
    expect(options().getByText("بيض")).toBeTruthy()
    fireEvent.click(menuOf("eggs"))
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })
})

describe("a card holding exactly one product", () => {
  it("rings it straight into the cart — no menu", async () => {
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    await ready()
    fireEvent.click(card("eggs"))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: "بيض" }))
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })

  it("shows the price instead of a count — «1» tells the cashier nothing", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    expect(card("eggs").textContent).toContain("12")
  })

  it("still reaches its + and X through the chevron", async () => {
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    await ready()
    fireEvent.click(screen.getByTestId("quick-card-eggs-menu"))
    expect(onPick).not.toHaveBeenCalled()
    expect(options().getByText(/إضافة صنف إلى/)).toBeTruthy()
    expect(
      options().getByRole("button", { name: "إزالة من هذه المجموعة" }),
    ).toBeTruthy()
  })

  it("gives a multi-item card no chevron — its own button is the menu", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    expect(screen.queryByTestId("quick-card-smoke-menu")).toBeNull()
  })
})

describe("the + at the end of every list", () => {
  async function openPicker(key: string) {
    await ready(key)
    fireEvent.click(menuOf(key))
    fireEvent.click(options().getByText(/إضافة صنف إلى/))
  }

  it("searches the WHOLE catalogue, including scannable products", async () => {
    // The owner may well want a barcoded product on a card — the picker must
    // not be limited to the barcode-less list.
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker("eggs")
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "بندورة" },
    })
    expect(picker().getByText("بندورة")).toBeTruthy()
  })

  it("finds a product by barcode too — the gun works in the picker", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker("eggs")
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "111222" },
    })
    expect(picker().getByText("بندورة")).toBeTruthy()
  })

  it("saves the pick to the store, not to localStorage", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker("eggs")
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "بندورة" },
    })
    fireEvent.click(picker().getByText("بندورة"))

    await waitFor(() => expect(putQuickGroups).toHaveBeenCalled())
    expect(sentGroups().find((g) => g.key === "eggs")?.product_ids).toContain(6)
    // and the other cards survive the write
    expect(sentGroups().find((g) => g.key === "smoke")?.product_ids).toEqual([
      1, 2, 3,
    ])
  })

  it("never adds the same product to a card twice", async () => {
    savedLayout([
      { key: "eggs", label: "بيض", icon: "egg", product_ids: [4, 6] },
    ])
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await openPicker("eggs")
    fireEvent.change(screen.getByLabelText("ابحث عن صنف لإضافته"), {
      target: { value: "بندورة" },
    })
    fireEvent.click(picker().getByText("بندورة"))

    await waitFor(() => expect(putQuickGroups).toHaveBeenCalled())
    expect(sentGroups()[0].product_ids).toEqual([4, 6])
  })
})

describe("removing an option", () => {
  it("drops it from the card and saves", async () => {
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    fireEvent.click(await ready())
    const row = options().getByText("دخان عربي").closest("div") as HTMLElement
    fireEvent.click(
      within(row).getByRole("button", { name: "إزالة من هذه المجموعة" }),
    )

    await waitFor(() => expect(putQuickGroups).toHaveBeenCalled())
    expect(sentGroups().find((g) => g.key === "smoke")?.product_ids).toEqual([
      1, 2,
    ])
  })
})

describe("a saved layout", () => {
  it("wins over the defaults, even when it is deliberately small", async () => {
    savedLayout([
      { key: "smoke", label: "دخان", icon: "cigarette", product_ids: [1] },
    ])
    render(<QuickCards catalog={CATALOG} onPick={vi.fn()} />)
    await ready()
    // the shop removed the eggs card on purpose — do not resurrect it
    expect(noCard("eggs")).toBeNull()
  })

  it("silently drops ids whose product no longer exists", async () => {
    savedLayout([
      { key: "eggs", label: "بيض", icon: "egg", product_ids: [4, 9999] },
    ])
    const onPick = vi.fn()
    render(<QuickCards catalog={CATALOG} onPick={onPick} />)
    await ready("eggs")
    // One id resolves, one is a product deleted months ago. That makes this a
    // ONE-item card — it must ring on the first tap, not open a menu holding a
    // single line and a dead tile.
    fireEvent.click(card("eggs"))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: "بيض" }))
    expect(screen.queryByTestId("quick-card-options")).toBeNull()
  })
})
