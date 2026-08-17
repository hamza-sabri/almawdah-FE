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
  { id: 1, name: "بندورة", barcode: "111", price: "7.00", stock: 12, category: "خضار" },
  { id: 2, name: "فول", barcode: "222", price: "3.00", stock: 0, category: "معلبات" },
  { id: 3, name: "أرز", barcode: "333", price: "11.00", stock: 3, category: "معلبات" },
]

vi.mock("@/lib/offline/catalog-cache", () => ({
  readCachedCatalog: vi.fn(async () => CATALOG),
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
  beforeEach(() => vi.clearAllMocks())

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
})
