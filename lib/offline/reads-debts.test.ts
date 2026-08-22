import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * A customer's debts, offline.
 *
 * This file exists because of a live incident: /customers/4 showed
 * "لا توجد ديون" under a balance of ₪18,870, and did it intermittently, so it
 * looked like a fluke rather than a bug. Two things caused it, and both are
 * about the same mistake — treating a filtered list and the whole list as the
 * same cached object:
 *
 *   1. `/debts/?customer=4` was written into the ONE shared `read:debts:list`
 *      slot, so the last customer visited overwrote the cached list for
 *      everybody.
 *   2. The reader ignored `?customer=` entirely, so it answered every
 *      customer's page with whatever happened to be in that slot — an empty
 *      list, or somebody else's debts.
 *
 * And when nothing had ever been cached it returned an empty list rather than
 * "I don't know", which renders identically to a customer who owes nothing.
 */

const H = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(async () => {}),
  listQueuedSales: vi.fn(async () => []),
}))

vi.mock("@/lib/offline/idb", () => ({
  STORE_KV: "kv",
  idbGet: H.idbGet,
  idbPut: H.idbPut,
}))
vi.mock("@/lib/offline/queue", () => ({ listQueuedSales: H.listQueuedSales }))
vi.mock("@/lib/offline/catalog-cache", () => ({
  readCachedCatalog: vi.fn(async () => []),
}))

import { localReadResponse, cacheReadResponse } from "@/lib/offline/reads"

type Row = {
  id: number
  customer: number
  customer_name: string
  total: string
  discounted_total: string
  is_paid: boolean
  created_at: string
}

const debt = (id: number, customer: number, total: string, paid = false): Row => ({
  id,
  customer,
  customer_name: `c${customer}`,
  total,
  discounted_total: total,
  is_paid: paid,
  created_at: `2026-08-${String(10 + id).padStart(2, "0")}T09:00:00Z`,
})

/** The unfiltered list as it was last seen online. */
const CACHED = {
  results: [
    debt(1, 4, "18827.00"),
    debt(2, 4, "43.00"),
    debt(3, 7, "493.00"),
    debt(4, 9, "100.00", true),
  ],
}

type Env = { data: { count: number; results: Row[] } }

async function read(url: string) {
  const r = await localReadResponse<Env>(url)
  return r ? r.data : null
}

beforeEach(() => {
  vi.clearAllMocks()
  H.listQueuedSales.mockResolvedValue([])
  H.idbGet.mockImplementation(async (_store: string, k: string) =>
    k === "read:debts:list" ? { at: Date.now(), data: CACHED } : undefined,
  )
})

describe("offline debts list", () => {
  it("answers a customer's page with that customer's debts only", async () => {
    const d = await read("/api/v1/debts/?customer=4&ordering=-created_at")
    expect(d).not.toBeNull()
    expect(d!.results.map((r) => r.id).sort()).toEqual([1, 2])
    expect(d!.count).toBe(2)
  })

  it("never shows one customer's debts on another's page", async () => {
    const d = await read("/api/v1/debts/?customer=7")
    expect(d!.results.every((r) => r.customer === 7)).toBe(true)
  })

  it("returns an honest empty list for a customer who owes nothing", async () => {
    const d = await read("/api/v1/debts/?customer=99")
    expect(d!.results).toEqual([])
  })

  it("says 'I don't know' rather than 'no debts' when nothing was ever cached", async () => {
    H.idbGet.mockResolvedValue(undefined)
    // null => customFetch falls through to the network / the page's error
    // state. THIS is the assertion that keeps ₪18,870 from reading as zero.
    expect(await read("/api/v1/debts/?customer=4")).toBeNull()
  })

  it("honours ?is_paid", async () => {
    const paid = await read("/api/v1/debts/?is_paid=true")
    expect(paid!.results.map((r) => r.id)).toEqual([4])
    const unpaid = await read("/api/v1/debts/?is_paid=false")
    expect(unpaid!.results.map((r) => r.id).sort()).toEqual([1, 2, 3])
  })

  it("paginates instead of repeating page 1", async () => {
    const p1 = await read("/api/v1/debts/?page=1&page_size=2")
    const p2 = await read("/api/v1/debts/?page=2&page_size=2")
    expect(p1!.results).toHaveLength(2)
    expect(p2!.results).toHaveLength(2)
    expect(p1!.results.map((r) => r.id)).not.toEqual(p2!.results.map((r) => r.id))
    expect(p1!.count).toBe(4)
  })

  it("sorts newest first by default", async () => {
    const d = await read("/api/v1/debts/?customer=4")
    expect(d!.results[0].id).toBe(2) // created 2026-08-12 > 2026-08-11
  })
})

describe("what earns the shared cache slot", () => {
  it("refuses to store a customer-filtered response as the whole list", async () => {
    await cacheReadResponse("/api/v1/debts/?customer=4", CACHED)
    expect(H.idbPut).not.toHaveBeenCalled()
  })

  it("refuses a search-filtered or second-page response", async () => {
    await cacheReadResponse("/api/v1/debts/?search=همام", CACHED)
    await cacheReadResponse("/api/v1/debts/?page=2", CACHED)
    await cacheReadResponse("/api/v1/debts/?is_paid=true", CACHED)
    expect(H.idbPut).not.toHaveBeenCalled()
  })

  it("stores the unfiltered first page", async () => {
    await cacheReadResponse("/api/v1/debts/", CACHED)
    expect(H.idbPut).toHaveBeenCalledWith(
      "kv",
      expect.objectContaining({ data: CACHED }),
      "read:debts:list",
    )
  })
})
