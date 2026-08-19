import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * /inventory offline. The page reads GET /products/ with whatever chips are in
 * the URL; offline that call is answered from the IndexedDB catalogue mirror.
 *
 * The trap this guards: the page renders its filter chips from the URL whether
 * or not there's a network. An offline handler that ignored ?category= or
 * ?stock_state= would list the whole catalogue under a chip that says
 * "نافد" — worse than an error, because it looks correct.
 */

const CATALOG = [
  {
    id: 1,
    name: "بندورة",
    barcode: "111",
    // A second sticker on the same item — must resolve offline too.
    alt_barcodes: ["111-ALT", "6291234567890"],
    price: "7.00",
    stock: 12,
    category: "خضار",
  },
  { id: 2, name: "فول", barcode: "222", price: "3.00", stock: 0, category: "معلبات" },
  { id: 3, name: "أرز", barcode: "333", price: "11.00", stock: 3, category: "معلبات" },
]

/**
 * The same three rows plus the two shapes the "الوحدات" chips exist to tell
 * apart: a real box, and a variant that is only a flavour.
 */
const CATALOG_WITH_UNITS = [
  ...CATALOG,
  // Sold by the box: 404 of the shop's 2,398 products have one.
  {
    id: 4,
    name: "بونشي",
    barcode: "444",
    price: "1.00",
    stock: 5,
    category: "معلبات",
    variants: [
      {
        id: 41, label: "عبوة ×24", barcode: "444-B",
        price: "20.00", stock: 2, pack_size: "24.000",
      },
    ],
  },
  // Has a variant, but it is a flavour — NOT a box.
  {
    id: 5,
    name: "عصير",
    barcode: "555",
    price: "3.00",
    stock: 4,
    category: "مشروبات",
    variants: [
      {
        id: 51, label: "فراولة", barcode: "555-F",
        price: "3.00", stock: 4, pack_size: null,
      },
    ],
  },
]

/** Which fixture the mocked mirror hands back for the current test. */
let mirror: unknown[] = CATALOG

vi.mock("@/lib/offline/catalog-cache", () => ({
  readCachedCatalog: vi.fn(async () => mirror),
}))
vi.mock("@/lib/offline/queue", () => ({ listQueuedSales: vi.fn(async () => []) }))
vi.mock("@/lib/offline/idb", () => ({
  STORE_KV: "kv",
  idbGet: vi.fn(async () => undefined),
  idbPut: vi.fn(async () => {}),
}))

import { localReadResponse } from "@/lib/offline/reads"

type Page = { data: { count: number; results: { id: number; name: string }[] } }

async function list(query: string) {
  const r = await localReadResponse<Page>(`/api/v1/products/${query}`)
  return r!.data
}

describe("offline /products/ answers the inventory page's filters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mirror = CATALOG
  })

  it("returns the whole catalogue with no filters", async () => {
    expect((await list("")).count).toBe(3)
  })

  it("filters by category", async () => {
    const p = await list("?category=معلبات")
    expect(p.count).toBe(2)
    expect(p.results.map((r) => r.name).sort()).toEqual(["أرز", "فول"])
  })

  it("filters by stock state, matching the backend's 1..5 low band", async () => {
    expect((await list("?stock_state=out")).results.map((r) => r.name)).toEqual(["فول"])
    expect((await list("?stock_state=low")).results.map((r) => r.name)).toEqual(["أرز"])
    expect((await list("?stock_state=in")).count).toBe(2)
  })

  it("combines a category and a stock state", async () => {
    const p = await list("?category=معلبات&stock_state=out")
    expect(p.results.map((r) => r.name)).toEqual(["فول"])
  })

  it("sorts by price, both directions", async () => {
    expect((await list("?ordering=price")).results.map((r) => r.id)).toEqual([2, 1, 3])
    expect((await list("?ordering=-price")).results.map((r) => r.id)).toEqual([3, 1, 2])
  })

  it("sorts by stock descending", async () => {
    expect((await list("?ordering=-stock")).results.map((r) => r.id)).toEqual([1, 3, 2])
  })

  it("paginates and reports the filtered count, not the catalogue's", async () => {
    const p = await list("?page_size=2&page=2&ordering=name")
    expect(p.count).toBe(3)
    expect(p.results).toHaveLength(1)
  })

  it("still matches a barcode scan", async () => {
    expect((await list("?barcode=222")).results.map((r) => r.name)).toEqual(["فول"])
  })

  it("refuses filters the catalogue cannot express, rather than lying", async () => {
    // No expiry dates in the mirror — the page should show its retry state.
    expect(await localReadResponse("/api/v1/products/?expiry=soon")).toBeNull()
    expect(await localReadResponse("/api/v1/products/?manufacturer=X")).toBeNull()
  })

  it("ignores an ordering it cannot honour instead of erroring", async () => {
    const p = await list("?ordering=-created_at")
    expect(p.count).toBe(3)
  })

  it("resolves ANY of a product's barcodes, not just the primary", async () => {
    // Offline used to match `barcode` only, so the same scan that worked
    // online reported "not found" the moment the line dropped.
    expect((await list("?barcode=111-ALT")).results.map((r) => r.name)).toEqual([
      "بندورة",
    ])
    expect(
      (await list("?barcode=6291234567890")).results.map((r) => r.name),
    ).toEqual(["بندورة"])
  })

  it("searches the extra barcodes too", async () => {
    expect((await list("?search=6291234")).results.map((r) => r.name)).toEqual([
      "بندورة",
    ])
  })
})

/**
 * The "الوحدات" chips. A box is priced differently from the pieces inside it,
 * so "which products come in a box" is the question the owner asks before a
 * stocktake or a price change — and it has to answer the same offline, since
 * the shop's connection is the thing that drops.
 */
describe("offline /products/?units=", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mirror = CATALOG_WITH_UNITS
  })

  it("units=pack lists only what has a real box size", async () => {
    const d = await list("?units=pack")
    expect(d.results.map((r) => r.name)).toEqual(["بونشي"])
  })

  it("a flavour variant is not a box", async () => {
    const d = await list("?units=pack")
    expect(d.results.map((r) => r.name)).not.toContain("عصير")
  })

  it("units=variant lists anything with a sub-SKU", async () => {
    const d = await list("?units=variant")
    expect(d.results.map((r) => r.name).sort()).toEqual(["بونشي", "عصير"])
  })

  it("units=plain lists only single-piece products", async () => {
    const d = await list("?units=plain")
    expect(d.results.map((r) => r.name).sort()).toEqual(
      ["أرز", "بندورة", "فول"].sort(),
    )
  })

  it("the count matches the filtered rows, not the catalogue", async () => {
    const d = await list("?units=pack")
    expect(d.count).toBe(1)
  })

  it("composes with the other chips instead of replacing them", async () => {
    const d = await list("?units=variant&category=معلبات")
    expect(d.results.map((r) => r.name)).toEqual(["بونشي"])
  })

  it("an unknown value lists everything rather than nothing", async () => {
    const d = await list("?units=banana")
    expect(d.count).toBe(CATALOG_WITH_UNITS.length)
  })
})
