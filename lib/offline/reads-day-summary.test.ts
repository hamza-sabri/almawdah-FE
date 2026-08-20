import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * The day cards, offline.
 *
 * A shop does not stop selling because the line dropped. If these figures
 * vanish — or worse, silently freeze — during a cut, the owner is reading a
 * total that stopped counting and has no way to know. So offline they serve
 * the last figures the server gave, plus the sales still sitting in the till's
 * own queue.
 *
 * The grouping rule comes from the SERVER, in the response. Keeping a second
 * copy of those words here would drift the first time the shop stocks a brand
 * neither side knew about.
 */

const DAY_START = "2026-08-20T04:00:00.000+03:00"
const DAY_END = "2026-08-21T04:00:00.000+03:00"

const CACHED: unknown = {
  day_start: DAY_START,
  day_end: DAY_END,
  cutover_hour: 4,
  total: { amount: "1000.00", count: 100 },
  groups: [
    { key: "topup", label: "جوال", amount: "50.00", count: 2, match: "تعبئة كرت|شحن رصيد" },
    { key: "smoke", label: "دخان", amount: "80.00", count: 4, match: "دخان|سيجارة" },
  ],
}

/** Inside the cached window. */
const at = (iso: string) => Date.parse(iso)

const H = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(async () => {}),
  listQueuedSales: vi.fn(),
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

import { localReadResponse } from "@/lib/offline/reads"
import type { DaySummary } from "@/api/sales"

type Env = { data: DaySummary }

async function read(): Promise<DaySummary | null> {
  const r = await localReadResponse<Env>("/api/v1/sales/day_summary/")
  return r ? r.data : null
}

const group = (d: DaySummary, key: string) =>
  d.groups.find((g) => g.key === key)!

beforeEach(() => {
  vi.clearAllMocks()
  H.idbGet.mockResolvedValue({ at: Date.now(), data: CACHED })
  H.listQueuedSales.mockResolvedValue([])
})

describe("with nothing queued", () => {
  it("serves the last figures the server gave", async () => {
    const d = await read()
    expect(d?.total.amount).toBe("1000.00")
    expect(d?.total.count).toBe(100)
  })

  it("returns nothing at all if it was never cached online", async () => {
    // Better a card that is absent than a card confidently showing ₪0.00.
    H.idbGet.mockResolvedValue(undefined)
    expect(await read()).toBeNull()
  })
})

describe("with sales taken during the cut", () => {
  beforeEach(() => {
    H.listQueuedSales.mockResolvedValue([
      {
        clientUuid: "u1",
        createdAt: at("2026-08-20T10:00:00.000+03:00"),
        isReturn: false,
        paymentMethod: "cash",
        total: 60,
        discountedTotal: 60,
        payload: {
          items: [
            { medication_name: "تعبئة كرت جوال", quantity: 1, unit_price: "50.00" },
            { medication_name: "أرز", quantity: 1, unit_price: "10.00" },
          ],
        },
      },
      {
        clientUuid: "u2",
        createdAt: at("2026-08-20T11:00:00.000+03:00"),
        isReturn: false,
        paymentMethod: "cash",
        total: 26,
        discountedTotal: 26,
        payload: {
          items: [{ medication_name: "دخان امبريال", quantity: 1, unit_price: "26.00" }],
        },
      },
    ])
  })

  it("adds them to the day's total", async () => {
    const d = await read()
    expect(d?.total.amount).toBe("1086.00")
    expect(d?.total.count).toBe(102)
  })

  it("adds them to the right group, by the SERVER's rule", async () => {
    const d = await read()
    expect(group(d!, "topup").amount).toBe("100.00")
    expect(group(d!, "smoke").amount).toBe("106.00")
  })

  it("counts receipts, not lines — same as the server", async () => {
    const d = await read()
    expect(group(d!, "topup").count).toBe(3)
    expect(group(d!, "smoke").count).toBe(5)
  })

  it("leaves the ungrouped line out of both groups but in the total", async () => {
    // أرز is neither جوال nor دخان; it is still money taken today.
    const d = await read()
    const grouped =
      Number(group(d!, "topup").amount) + Number(group(d!, "smoke").amount)
    expect(grouped).toBeLessThan(Number(d!.total.amount))
  })
})

describe("the trading-day window is respected offline too", () => {
  it("ignores a sale queued before the window opened", async () => {
    // 03:00 belongs to YESTERDAY's trading day — the server would not have
    // counted it, so neither may the till.
    H.listQueuedSales.mockResolvedValue([
      {
        clientUuid: "old",
        createdAt: at("2026-08-20T03:00:00.000+03:00"),
        isReturn: false,
        paymentMethod: "cash",
        total: 999,
        discountedTotal: 999,
        payload: { items: [{ medication_name: "دخان عربي", quantity: 1, unit_price: "999" }] },
      },
    ])
    const d = await read()
    expect(d?.total.amount).toBe("1000.00")
    expect(group(d!, "smoke").amount).toBe("80.00")
  })
})

describe("returns", () => {
  it("subtract, offline as well", async () => {
    H.listQueuedSales.mockResolvedValue([
      {
        clientUuid: "r1",
        createdAt: at("2026-08-20T12:00:00.000+03:00"),
        isReturn: true,
        paymentMethod: "cash",
        total: 26,
        discountedTotal: 26,
        payload: { items: [{ medication_name: "دخان امبريال", quantity: 1, unit_price: "26.00" }] },
      },
    ])
    const d = await read()
    expect(d?.total.amount).toBe("974.00")
    expect(group(d!, "smoke").amount).toBe("54.00")
  })
})

describe("a pattern this browser cannot compile", () => {
  it("leaves that group's figure alone rather than throwing", async () => {
    H.idbGet.mockResolvedValue({
      at: Date.now(),
      data: {
        ...(CACHED as DaySummary),
        groups: [{ key: "smoke", label: "دخان", amount: "80.00", count: 4, match: "[" }],
      },
    })
    H.listQueuedSales.mockResolvedValue([
      {
        clientUuid: "u1",
        createdAt: at("2026-08-20T10:00:00.000+03:00"),
        isReturn: false,
        paymentMethod: "cash",
        total: 26,
        discountedTotal: 26,
        payload: { items: [{ medication_name: "دخان عربي", quantity: 1, unit_price: "26.00" }] },
      },
    ])
    const d = await read()
    expect(group(d!, "smoke").amount).toBe("80.00")
    // …and the total still counts the money.
    expect(d?.total.amount).toBe("1026.00")
  })
})
