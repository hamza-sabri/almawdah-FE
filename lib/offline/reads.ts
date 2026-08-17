"use client"

import type { Sale, SalesStats } from "@/api/sales"
import type { Debt } from "@/api/generated/model"
import { STORE_KV, idbGet, idbPut } from "@/lib/offline/idb"
import { listQueuedSales } from "@/lib/offline/queue"
import { readCachedCatalog } from "@/lib/offline/catalog-cache"

/**
 * Offline reads for the top tier: while there's no connection the app serves
 * the Sales list, sales stats, /me/ and the customers quick-list from the last
 * cached copy — MERGED with the sales the cashier made offline (still in the
 * local queue) — so the Sales page and its numbers reflect the local work.
 */

type Env<T> = { status: number; data: T; headers: Headers }
const ok = <T>(data: T): Env<T> => ({ status: 200, data, headers: new Headers() })

function keyFor(url: string): string | null {
  const [path, query = ""] = url.split("?")
  if (path.endsWith("/sales/stats/")) return "read:sales:stats"
  if (path.endsWith("/sales/")) return "read:sales:list"
  if (path.endsWith("/debts/dashboard/")) return "read:debts:dashboard"
  if (path.endsWith("/debts/")) return "read:debts:list"
  if (path.endsWith("/customers/quick/")) return "read:customers-quick"
  if (path.endsWith("/customers/")) return "read:customers:list"
  if (path.endsWith("/auth/me/")) return "read:me"
  // Reports: cache per selected period so the ٧/٣٠/٩٠ chips each keep their
  // own last-good copy and the reports pages work offline like the rest.
  if (path.endsWith("/reports/summary/") || path.endsWith("/reports/sales/summary/")) {
    const days = new URLSearchParams(query).get("days") || "30"
    const kind = path.endsWith("/reports/sales/summary/") ? "sales" : "summary"
    return `read:reports:${kind}:${days}`
  }
  if (path.endsWith("/reports/teaser/")) return "read:reports:teaser"
  // Pages that used to hard-fail offline because nothing was cached for them.
  if (path.endsWith("/products/stats/")) return "read:meds:stats"
  if (path.endsWith("/purchase-orders/")) return "read:purchase-orders"
  if (path.endsWith("/reports/restock-quota/")) return "read:restock-quota"
  if (path.endsWith("/reports/scans/")) return "read:reports:scans"
  if (path.endsWith("/store/branding/")) return "read:branding"
  return null
}

/** Write-through cache for a successful online GET. */
export async function cacheReadResponse(url: string, data: unknown): Promise<void> {
  const k = keyFor(url)
  if (!k || data === undefined) return
  try {
    await idbPut(STORE_KV, { at: Date.now(), data }, k)
  } catch {
    /* private mode / quota — offline reads just won't have this one */
  }
}

async function cached<T>(k: string): Promise<T | undefined> {
  try {
    const v = await idbGet<{ at: number; data: T }>(STORE_KV, k)
    return v?.data
  } catch {
    return undefined
  }
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

async function queuedAsSales(): Promise<Sale[]> {
  const q = await listQueuedSales()
  if (q.length === 0) return []
  const cat = await readCachedCatalog()
  const byId = new Map((cat ?? []).map((m) => [m.id, m]))
  // Newest first, like the server list.
  return [...q].reverse().map((s, i) => {
    const items = (s.payload.items ?? []).map((it, j) => {
      const med = it.product != null ? byId.get(it.product) : undefined
      const unit = it.unit_price ?? String(med?.price ?? "0")
      return {
        id: j + 1,
        product: it.product ?? null,
        medication_name: it.medication_name || med?.name || "—",
        category: med?.category || "",
        unit_price: unit,
        quantity: it.quantity,
        line_total: money(Number(unit) * it.quantity),
      }
    })
    return {
      id: -(i + 1), // negative = a local, not-yet-synced sale
      customer: s.payload.customer ?? null,
      customer_name: s.customerName,
      payment_method: s.paymentMethod,
      is_return: s.isReturn,
      items,
      total: money(s.total),
      discounted_total: money(s.discountedTotal),
      debt: null,
      note: "",
      created_by_name: s.cashierName || "—",
      created_at: new Date(s.createdAt).toISOString(),
      updated_at: new Date(s.createdAt).toISOString(),
    } as Sale
  })
}

type ApiDashboard = {
  total_outstanding: string | number
  total_collected: string | number
  unpaid_count: number
  paid_count: number
  customer_count: number
  gender_counts: { male: number; female: number }
  monthly: { month: string; count: number; amount: string | number }[]
  top_debtors: { id: number; name: string; amount: string | number }[]
}

const EMPTY_DASHBOARD: ApiDashboard = {
  total_outstanding: "0.00",
  total_collected: "0.00",
  unpaid_count: 0,
  paid_count: 0,
  customer_count: 0,
  gender_counts: { male: 0, female: 0 },
  monthly: [],
  top_debtors: [],
}

/** Offline debt sales still in the queue (a debt sale = one unpaid debt). */
async function queuedDebtSales() {
  const q = await listQueuedSales()
  return q.filter((s) => s.paymentMethod === "debt" && !s.isReturn)
}

/** Render the queued debt sales as unpaid Debt rows (negative ids). */
async function queuedAsDebts(): Promise<Debt[]> {
  const q = await queuedDebtSales()
  if (q.length === 0) return []
  const cat = await readCachedCatalog()
  const byId = new Map((cat ?? []).map((m) => [m.id, m]))
  return [...q].reverse().map((s, i) => {
    const items = (s.payload.items ?? []).map((it, j) => {
      const med = it.product != null ? byId.get(it.product) : undefined
      const unit = it.unit_price ?? String(med?.price ?? "0")
      return {
        id: j + 1,
        product: it.product ?? null,
        medication_name: it.medication_name || med?.name || "—",
        unit_price: unit,
        quantity: it.quantity,
        line_total: money(Number(unit) * it.quantity),
      }
    })
    return {
      id: -(i + 1),
      customer: s.payload.customer ?? 0,
      customer_name: s.customerName || "—",
      customer_phone: "",
      items,
      total: money(s.total),
      discounted_total: money(s.discountedTotal),
      is_paid: false,
      note: "",
      created_at: new Date(s.createdAt).toISOString(),
      updated_at: new Date(s.createdAt).toISOString(),
    } as unknown as Debt
  })
}

const EMPTY_STATS: SalesStats = {
  periods: {
    today: { amount: "0.00", count: 0 },
    yesterday: { amount: "0.00", count: 0 },
    week: { amount: "0.00", count: 0 },
    month: { amount: "0.00", count: 0 },
    last_month: { amount: "0.00", count: 0 },
    all_time: { amount: "0.00", count: 0 },
  },
  by_category: [],
  daily: [],
  payment_split: { cash: "0.00", debt: "0.00" },
}

/** Serve a cacheable GET from local data while offline; null = can't. */
export async function localReadResponse<T>(url: string): Promise<T | null> {
  const path = url.split("?")[0]

  // POS catalogue (the full client-held list) — from the IndexedDB mirror.
  if (path.endsWith("/products/pos_catalog/")) {
    const cat = await readCachedCatalog()
    if (!cat) return null
    return ok({ count: cat.length, next: null, previous: null, results: cat }) as T
  }

  // Product grid list — serve from the cached catalogue, filtered by
  // ?search=/?barcode= and paginated, so products still SHOW offline instead
  // of erroring.
  if (path.endsWith("/products/")) {
    const cat = await readCachedCatalog()
    if (!cat) return null
    const u = new URL(url, "http://x")
    const search = (u.searchParams.get("search") || "").trim().toLowerCase()
    const barcode = (u.searchParams.get("barcode") || "").trim()
    const pageSize = Number(u.searchParams.get("page_size")) || 30
    const page = Number(u.searchParams.get("page")) || 1
    let rows = cat
    if (barcode) rows = rows.filter((m) => (m.barcode || "") === barcode)
    else if (search)
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          (m.barcode || "").includes(search),
      )
    const start = (page - 1) * pageSize
    const results = rows.slice(start, start + pageSize).map((m) => ({
      id: m.id,
      name: m.name,
      price: String(m.price),
      stock: m.stock,
      barcode: m.barcode,
      category: m.category,
    }))
    const next =
      start + pageSize < rows.length
        ? `http://x/api/v1/products/?page=${page + 1}`
        : null
    return ok({ count: rows.length, next, previous: null, results }) as T
  }

  // Customer detail — pulled from the cached customers list.
  const custDetail = path.match(/\/customers\/(\d+)\/$/)
  if (custDetail) {
    const list = await cached<{ results?: Array<{ id: number }> }>(
      "read:customers:list",
    )
    const found = (list?.results ?? []).find(
      (c) => c.id === Number(custDetail[1]),
    )
    return found ? (ok(found) as T) : null
  }

  const k = keyFor(url)
  if (!k) return null

  if (k === "read:debts:list") {
    const u = new URL(url, "http://x")
    const local =
      u.searchParams.get("is_paid") === "true" ? [] : await queuedAsDebts()
    const prev = (await cached<{ results?: Debt[] }>(k))?.results ?? []
    const results = [...local, ...prev]
    return ok({ count: results.length, next: null, previous: null, results }) as T
  }

  if (k === "read:debts:dashboard") {
    const base = (await cached<ApiDashboard>(k)) ?? EMPTY_DASHBOARD
    const q = await queuedDebtSales()
    if (q.length === 0) return ok(base) as T
    const extra = q.reduce((s, x) => s + x.discountedTotal, 0)
    return ok({
      ...base,
      total_outstanding: money(Number(base.total_outstanding) + extra),
      unpaid_count: base.unpaid_count + q.length,
    }) as T
  }

  if (k === "read:customers:list") {
    const base =
      (await cached<{
        results?: Array<{ id: number; name: string; phone?: string }>
      }>(k)) ?? { results: [] }
    const u = new URL(url, "http://x")
    const search = (u.searchParams.get("search") || "").trim().toLowerCase()
    let results = base.results ?? []
    if (search)
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.phone || "").includes(search),
      )
    return ok({ count: results.length, next: null, previous: null, results }) as T
  }

  if (k === "read:sales:list") {
    const local = await queuedAsSales()
    const prev = (await cached<{ results?: Sale[] }>(k))?.results ?? []
    const results = [...local, ...prev]
    return ok({ count: results.length, next: null, previous: null, results }) as T
  }

  if (k === "read:sales:stats") {
    const base = (await cached<SalesStats>(k)) ?? EMPTY_STATS
    const q = await listQueuedSales()
    let amt = 0
    let cash = 0
    let debt = 0
    for (const s of q) {
      const v = (s.isReturn ? -1 : 1) * s.discountedTotal
      amt += v
      if (s.paymentMethod === "cash") cash += v
      else debt += v
    }
    if (q.length === 0) return ok(base) as T
    const add = (b: { amount: string | number; count: number }) => ({
      amount: money(Number(b.amount) + amt),
      count: b.count + q.length,
    })
    return ok({
      ...base,
      periods: {
        ...base.periods,
        today: add(base.periods.today),
        week: add(base.periods.week),
        month: add(base.periods.month),
        all_time: add(base.periods.all_time),
      },
      payment_split: {
        cash: money(Number(base.payment_split.cash) + cash),
        debt: money(Number(base.payment_split.debt) + debt),
      },
    }) as T
  }

  // /me/ and customers-quick: just the last cached copy.
  const data = await cached<unknown>(k)
  return data === undefined ? null : (ok(data) as T)
}
