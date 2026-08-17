import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * /sales offline. Two jobs:
 *
 *  1. Show the sales taken while offline. They're still in the IndexedDB
 *     queue, so they get merged into the list with negative ids — the marker
 *     the "بانتظار المزامنة" pill reads (lib/offline/local-sale.ts).
 *  2. Not lie about filters. The page draws its chips from state whether or
 *     not there's a network, so an offline handler that ignored
 *     ?payment_method= would show cash sales under a chip saying "دين".
 */

const CACHED_SALES = [
  {
    id: 9001,
    payment_method: "cash",
    is_return: false,
    total: "50.00",
    discounted_total: "50.00",
    created_at: "2026-08-10T09:00:00.000Z",
    items: [],
  },
  {
    id: 9002,
    payment_method: "debt",
    is_return: false,
    total: "80.00",
    discounted_total: "80.00",
    created_at: "2026-08-12T09:00:00.000Z",
    items: [],
  },
]

const QUEUED = [
  {
    clientUuid: "u1",
    payload: { items: [{ product: 1, quantity: 2, unit_price: "7.00" }] },
    customerName: "",
    paymentMethod: "cash",
    isReturn: false,
    total: 14,
    discountedTotal: 14,
    createdAt: Date.parse("2026-08-17T10:00:00.000Z"),
    cashierName: "حمزة",
  },
]

// vi.mock factories are hoisted above the module scope, so the spies they
// close over have to be created in a hoisted block too.
const H = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(async () => {}),
  listQueuedSales: vi.fn(),
}))
const { idbPut } = H

vi.mock("@/lib/offline/idb", () => ({
  STORE_KV: "kv",
  idbGet: H.idbGet,
  idbPut: H.idbPut,
}))
vi.mock("@/lib/offline/queue", () => ({ listQueuedSales: H.listQueuedSales }))
vi.mock("@/lib/offline/catalog-cache", () => ({
  readCachedCatalog: vi.fn(async () => [
    { id: 1, name: "بندورة", barcode: "111", price: "7.00", stock: 5, category: "خضار" },
  ]),
}))

import { localReadResponse, cacheReadResponse } from "@/lib/offline/reads"
import { isLocalSale, saleNumberLabel } from "@/lib/offline/local-sale"

type Page = {
  data: { count: number; results: { id: number; payment_method: string }[] }
}

async function list(query = "") {
  const r = await localReadResponse<Page>(`/api/v1/sales/${query}`)
  return r!.data
}

describe("offline /sales/ merges the queue and honours the page's filters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    H.idbGet.mockImplementation(async (_store: string, key: string) =>
      key === "read:sales:list"
        ? { at: 0, data: { results: CACHED_SALES } }
        : undefined,
    )
    H.listQueuedSales.mockImplementation(async () => QUEUED)
  })

  it("puts the unsynced sales in front of the cached history", async () => {
    const p = await list()
    expect(p.count).toBe(3)
    expect(p.results[0].id).toBeLessThan(0)
    expect(isLocalSale(p.results[0].id)).toBe(true)
    // Default ordering is -created_at, so the rest are newest-first.
    expect(p.results.slice(1).map((s) => s.id)).toEqual([9002, 9001])
  })

  it("labels an unsynced sale instead of printing a negative receipt number", () => {
    expect(saleNumberLabel(-1)).not.toContain("-1")
    expect(saleNumberLabel(-1)).toContain("بانتظار المزامنة")
    expect(saleNumberLabel(9001)).toBe("بيع رقم 9001")
  })

  it("filters by payment method, queue included", async () => {
    const cash = await list("?payment_method=cash")
    expect(cash.count).toBe(2) // the queued one + 9001
    expect(cash.results.every((s) => s.payment_method === "cash")).toBe(true)

    const debt = await list("?payment_method=debt")
    expect(debt.results.map((s) => s.id)).toEqual([9002])
  })

  it("filters by date, inclusive of the end day", async () => {
    const p = await list("?created_after=2026-08-11&created_before=2026-08-12")
    expect(p.results.map((s) => s.id)).toEqual([9002])
  })

  it("sorts oldest-first when asked", async () => {
    const p = await list("?ordering=created_at")
    expect(p.results.map((s) => s.id)).toEqual([9001, 9002, -1])
  })

  it("paginates against the filtered count", async () => {
    const p = await list("?page_size=2&page=2")
    expect(p.count).toBe(3)
    expect(p.results).toHaveLength(1)
  })

  it("refuses filters the cache cannot answer", async () => {
    expect(await localReadResponse("/api/v1/sales/?item=بندورة")).toBeNull()
    expect(await localReadResponse("/api/v1/sales/?min_price=10")).toBeNull()
    expect(await localReadResponse("/api/v1/sales/?created_by=3")).toBeNull()
  })
})

describe("only the unfiltered first page becomes the offline base", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    H.idbGet.mockImplementation(async (_store: string, key: string) =>
      key === "read:sales:list"
        ? { at: 0, data: { results: CACHED_SALES } }
        : undefined,
    )
    H.listQueuedSales.mockImplementation(async () => QUEUED)
  })

  it("caches an unfiltered page 1", async () => {
    await cacheReadResponse("/api/v1/sales/?page=1&page_size=30", { results: [] })
    expect(idbPut).toHaveBeenCalledOnce()
  })

  it("does not let a filtered response overwrite it", async () => {
    // Browsing to "دين" online must not shrink what's there offline.
    await cacheReadResponse("/api/v1/sales/?payment_method=debt", { results: [] })
    expect(idbPut).not.toHaveBeenCalled()
  })

  it("does not let page 2 overwrite it", async () => {
    await cacheReadResponse("/api/v1/sales/?page=2", { results: [] })
    expect(idbPut).not.toHaveBeenCalled()
  })
})
