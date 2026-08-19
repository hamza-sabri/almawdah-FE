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

/**
 * The sales list is cached under ONE key, so a filtered response would
 * overwrite the offline base with a subset — browse to "دين" online, go
 * offline, and the unfiltered history silently shows only debt sales. Only the
 * unfiltered first page earns the slot; the offline reader applies filters
 * itself.
 */
const SALES_FILTER_PARAMS = [
  "payment_method",
  "is_return",
  "item",
  "customer",
  "created_after",
  "created_before",
  "min_price",
  "max_price",
  "created_by",
  "search",
]

function isCacheableSalesList(url: string): boolean {
  const u = new URL(url, "http://x")
  if (SALES_FILTER_PARAMS.some((p) => u.searchParams.get(p))) return false
  const page = Number(u.searchParams.get("page")) || 1
  return page === 1
}

/** Write-through cache for a successful online GET. */
export async function cacheReadResponse(url: string, data: unknown): Promise<void> {
  const k = keyFor(url)
  if (!k || data === undefined) return
  if (k === "read:sales:list" && !isCacheableSalesList(url)) return
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
      // The number printed on the paper the customer walked out with. Minted
      // on the till before the POST, so scanning it finds this row offline and
      // the same row after it syncs.
      receipt_code: s.payload.receipt_code,
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

  // Product grid list — serve from the cached catalogue, filtered/sorted/
  // paginated, so products still SHOW offline instead of erroring.
  //
  // The filters matter as much as the rows: /inventory renders its chips from
  // the URL regardless of connectivity, so if we ignored ?category= the page
  // would claim to be filtered while listing everything. Anything the cached
  // catalogue can't answer (expiry dates aren't in it) is left alone rather
  // than faked.
  if (path.endsWith("/products/")) {
    const cat = await readCachedCatalog()
    if (!cat) return null
    const u = new URL(url, "http://x")
    // Filters the catalogue can't express. Better to fail into the page's
    // retry state than to hand back an unfiltered list under a filter chip.
    if (u.searchParams.get("expiry") || u.searchParams.get("manufacturer"))
      return null
    const search = (u.searchParams.get("search") || "").trim().toLowerCase()
    const units = u.searchParams.get("units") || ""
    const barcode = (u.searchParams.get("barcode") || "").trim()
    const category = (u.searchParams.get("category") || "").trim()
    const stockState = u.searchParams.get("stock_state") || ""
    const ordering = u.searchParams.get("ordering") || ""
    const pageSize = Number(u.searchParams.get("page_size")) || 30
    const page = Number(u.searchParams.get("page")) || 1
    let rows = cat
    // A product can carry several barcodes (shelf label, supplier box, unit
    // code on a multipack). Offline has to resolve ALL of them, or the same
    // scan that works online reports "not found" the moment the line drops.
    const codesOf = (m: { barcode?: string; alt_barcodes?: string[] }) => [
      m.barcode || "",
      ...(m.alt_barcodes ?? []),
    ]
    if (barcode) rows = rows.filter((m) => codesOf(m).includes(barcode))
    else if (search)
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          codesOf(m).some((c) => c.includes(search)),
      )
    if (category) rows = rows.filter((m) => (m.category || "") === category)
    // ?units= — the cached catalogue carries each variant's pack_size, so all
    // three answers are exact offline rather than an unfiltered list under a
    // filter chip.
    if (units === "pack")
      rows = rows.filter((m) =>
        (m.variants ?? []).some((v) => Number(v.pack_size ?? 0) > 0),
      )
    else if (units === "variant")
      rows = rows.filter((m) => (m.variants ?? []).length > 0)
    else if (units === "plain")
      rows = rows.filter((m) => (m.variants ?? []).length === 0)
    if (stockState === "out") rows = rows.filter((m) => Number(m.stock) <= 0)
    else if (stockState === "in") rows = rows.filter((m) => Number(m.stock) > 0)
    // 5 mirrors ProductViewSet.LOW_STOCK_MAX on the backend. If that ever
    // becomes owner-configurable, this needs to read the same value.
    else if (stockState === "low")
      rows = rows.filter((m) => Number(m.stock) > 0 && Number(m.stock) <= 5)

    if (ordering) {
      const desc = ordering.startsWith("-")
      const field = desc ? ordering.slice(1) : ordering
      const num = (m: (typeof rows)[number]) =>
        field === "price" ? Number(m.price) : Number(m.stock)
      if (field === "name" || field === "price" || field === "stock") {
        rows = [...rows].sort((a, b) => {
          const d =
            field === "name"
              ? a.name.localeCompare(b.name, "ar")
              : num(a) - num(b)
          return desc ? -d : d
        })
      }
      // -created_at / expiry_date: the catalogue carries neither, so we serve
      // the catalogue's own order rather than a wrong one.
    }
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

  // Sales history: the last page fetched online, with the sales still sitting
  // in the offline queue merged in front (negative ids — see
  // lib/offline/local-sale.ts, which is what puts the "بانتظار المزامنة" pill
  // on those rows). Queued sales are the ones the cashier most needs to see
  // offline, so they lead the list.
  //
  // The page's filter chips render from state regardless of connectivity, so
  // the filters we CAN apply we do, and the ones we can't we refuse — a chip
  // reading "دين" above a list of cash sales is worse than a retry button.
  if (k === "read:sales:list") {
    const u = new URL(url, "http://x")
    const unsupported = [
      "item",
      "customer",
      "min_price",
      "max_price",
      "created_by",
    ]
    if (unsupported.some((p) => u.searchParams.get(p))) return null

    const local = await queuedAsSales()
    const prev = (await cached<{ results?: Sale[] }>(k))?.results ?? []
    let rows = [...local, ...prev]

    // Scanning the barcode on a receipt is the one search that MUST work with
    // no network: the sale most likely to be queried offline is the one just
    // rung up offline, and it is sitting in the queue right here. Exact match,
    // like the server — a partial code must not return "some sale, probably
    // yours". Any other search term is a name/product lookup the mirror can't
    // answer, so it refuses rather than showing an unfiltered list.
    const term = (u.searchParams.get("search") || "").trim()
    if (term) {
      if (!/^[0-9]{12}$/.test(term)) return null
      rows = rows.filter((s) => s.receipt_code === term)
    }

    const payment = u.searchParams.get("payment_method")
    if (payment) rows = rows.filter((s) => s.payment_method === payment)
    const isReturn = u.searchParams.get("is_return")
    if (isReturn === "true") rows = rows.filter((s) => Boolean(s.is_return))
    else if (isReturn === "false") rows = rows.filter((s) => !s.is_return)
    const after = u.searchParams.get("created_after")
    if (after) rows = rows.filter((s) => s.created_at >= after)
    const before = u.searchParams.get("created_before")
    // created_before is a date; a sale ON that day must be included.
    if (before) rows = rows.filter((s) => s.created_at <= `${before}T23:59:59`)

    const ordering = u.searchParams.get("ordering") || "-created_at"
    const desc = ordering.startsWith("-")
    const field = desc ? ordering.slice(1) : ordering
    if (field === "created_at" || field === "discounted_total") {
      rows = [...rows].sort((a, b) => {
        const d =
          field === "created_at"
            ? a.created_at.localeCompare(b.created_at)
            : Number(a.discounted_total) - Number(b.discounted_total)
        return desc ? -d : d
      })
    }

    const pageSize = Number(u.searchParams.get("page_size")) || 30
    const page = Number(u.searchParams.get("page")) || 1
    const start = (page - 1) * pageSize
    return ok({
      count: rows.length,
      next: start + pageSize < rows.length ? `http://x/?page=${page + 1}` : null,
      previous: page > 1 ? `http://x/?page=${page - 1}` : null,
      results: rows.slice(start, start + pageSize),
    }) as T
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
