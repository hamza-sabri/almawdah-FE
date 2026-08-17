"use client"

/**
 * In-browser mock backend for the no-login guest demo. Every API call from
 * customFetch is routed here when isGuestDemo() is true, so the whole app runs
 * on local dummy data and NOTHING touches the real database. Sales/customers
 * are kept in memory for the session — reload = fresh demo.
 */

type Env<T> = { status: number; data: T; headers: Headers }
const ok = <T>(data: T, status = 200): Env<T> => ({
  status,
  data,
  headers: new Headers(),
})

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}
function now(): string {
  return new Date().toISOString()
}

/* ── Dummy catalogue (~a small slice of a real store) ─────────────── */
type Med = {
  id: number
  name: string
  barcode: string
  price: string
  cost?: string
  stock: number
  category: string
  image?: string
}

const CATS = ["مسكنات", "مضادات حيوية", "فيتامينات", "عناية بالبشرة", "أطفال", "برد وسعال", "جهاز هضمي", "متنوّع"]

const MEDS: Med[] = [
  ["بنادول إكسترا 24 قرص", "6001082000019", 12, 40, 0],
  ["بنادول أطفال شراب", "6001082000026", 15, 25, 4],
  ["أدول 500 20 قرص", "6281006000012", 8, 60, 0],
  ["فولتارين جل 50غ", "7613102000015", 28, 18, 3],
  ["بروفين 400 30 قرص", "5000158000017", 14, 32, 0],
  ["أموكسيسيلين 500 كبسولات", "6001234000011", 18, 22, 1],
  ["أوجمنتين 1غ 14 قرص", "5099010000014", 42, 15, 1],
  ["أزيثرومايسين 500", "6001234000028", 25, 12, 1],
  ["سيبروفلوكساسين 500", "6001234000035", 20, 14, 1],
  ["فيتامين د 50000", "6291100000013", 22, 45, 2],
  ["فيتامين سي فوّار", "4008500000018", 16, 38, 2],
  ["حديد شراب للأطفال", "6291100000020", 24, 20, 4],
  ["أوميغا 3 60 كبسولة", "0300450000017", 55, 16, 2],
  ["سنتروم للرجال", "0300450000024", 78, 9, 2],
  ["سيتال تحاميل أطفال", "6001082000033", 10, 30, 4],
  ["نيدو حليب أطفال 400غ", "7613030000019", 35, 28, 4],
  ["حفاضات بيبي جوي مقاس 3", "6281000000016", 45, 22, 4],
  ["مناديل مبللة أطفال", "6281000000023", 9, 50, 7],
  ["فكس شراب للسعال", "5000158000024", 19, 24, 5],
  ["ستربسلز أقراص استحلاب", "5000158000031", 11, 40, 5],
  ["أوتريفين بخاخ أنف", "7613102000022", 17, 26, 5],
  ["غافيسكون شراب", "5000158000048", 21, 20, 6],
  ["إنو فوّار للمعدة", "5000158000055", 7, 44, 6],
  ["موتيليوم 10 30 قرص", "6001234000042", 23, 17, 6],
  ["نيفيا كريم مرطب", "4005900000015", 26, 30, 3],
  ["سيرافي غسول للوجه", "3606000000012", 62, 14, 3],
  ["واقي شمس SPF50", "3606000000029", 70, 12, 3],
  ["ديتول مطهر 250مل", "6001106000011", 15, 33, 7],
  ["كمّامات طبية 50 قطعة", "6001106000028", 20, 40, 7],
  ["ميزان حرارة رقمي", "6001106000035", 30, 10, 7],
].map((r, i) => ({
  id: i + 1,
  name: r[0] as string,
  barcode: r[1] as string,
  price: money(r[2] as number),
  cost: money(((r[2] as number) * 0.7)),
  stock: r[3] as number,
  category: CATS[r[4] as number],
}))

/* A few believable data-quality quirks so the reports have something real to
 * "find" for a first-time visitor (this is the sales pitch of the reports
 * module — the demo must demonstrate it). */
{
  const diapers = MEDS.find((m) => m.id === 17)
  if (diapers) diapers.cost = "47.00" // sold below cost — 45 < 47
  const wipes = MEDS.find((m) => m.id === 18)
  if (wipes) wipes.stock = -3 // negative stock (over-sold vs records)
  const eno = MEDS.find((m) => m.id === 23)
  if (eno) eno.stock = 0 // bestseller currently out of stock
  const vicks = MEDS.find((m) => m.id === 19)
  if (vicks) vicks.stock = 4 // low stock
  const otrivin = MEDS.find((m) => m.id === 21)
  if (otrivin) otrivin.stock = 3 // low stock
}

/* ── In-memory session state ────────────────────────────────────────── */
type SaleItem = {
  id: number
  product: number | null
  medication_name: string
  category: string
  unit_price: string
  quantity: number
  line_total: string
}
type Sale = {
  id: number
  customer: number | null
  customer_name?: string
  payment_method: "cash" | "debt"
  is_return?: boolean
  items: SaleItem[]
  total: string
  discounted_total: string
  debt: number | null
  note: string
  created_by_name?: string
  created_at: string
  updated_at: string
}
type Customer = { id: number; name: string; phone: string; outstanding: string }

type DemoState = {
  meds: Med[]
  sales: Sale[]
  customers: Customer[]
  saleSeq: number
  seenUuids: Record<string, Sale>
  cart: Record<string, unknown>
}

// The guest's edits live ONLY on their machine and expire after 24h, then
// reset to clean seed data. Nothing here ever reaches the server.
const TTL_MS = 24 * 60 * 60 * 1000
const SKEY = "pharma_demo_state_v2" // v2: pre-seeded sales history

/* ── Seeded sales history (last 60 days) ─────────────────────────────
 * Deterministic PRNG so every guest lands in the same believable store:
 * bestsellers, quiet items, debt sales, a few returns — and three items that
 * never sell, so the reports genuinely "find" dead stock on first open.
 */
const DEAD_IDS = new Set([14, 27, 30]) // سنتروم، واقي شمس، ميزان حرارة — راكدة
const SELL_WEIGHTS: Record<number, number> = {
  1: 10, 2: 6, 3: 9, 4: 4, 5: 8, 6: 4, 7: 3, 8: 3, 9: 3, 10: 4,
  11: 6, 12: 4, 13: 3, 15: 6, 16: 4, 17: 3, 18: 3, 19: 5, 20: 5,
  21: 3, 22: 4, 23: 7, 24: 3, 25: 2, 26: 2, 28: 3, 29: 3,
}
const SEED_STAFF = ["رنا (موظفة)", "أبو كريم (المالك)"]

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedSales(customers: Customer[]): Sale[] {
  const rnd = mulberry32(1974)
  const pool: number[] = []
  for (const [id, w] of Object.entries(SELL_WEIGHTS))
    for (let i = 0; i < w; i++) pool.push(+id)

  const sales: Sale[] = []
  let seq = 0
  const debtTotals: Record<number, number> = { 1: 0, 2: 0 }

  for (let d = 59; d >= 0; d--) {
    const perDay = 4 + Math.floor(rnd() * 9) // 4–12 invoices a day
    for (let s = 0; s < perDay; s++) {
      const when = new Date()
      when.setDate(when.getDate() - d)
      when.setHours(9 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0)
      // Don't seed "future" sales for today.
      if (d === 0 && when.getTime() > Date.now()) continue

      const isReturn = rnd() < 0.02
      const nItems = isReturn ? 1 : 1 + Math.floor(rnd() * 3)
      const picked = new Set<number>()
      const items: SaleItem[] = []
      let total = 0
      for (let i = 0; i < nItems; i++) {
        const medId = pool[Math.floor(rnd() * pool.length)]
        if (picked.has(medId) || DEAD_IDS.has(medId)) continue
        picked.add(medId)
        const med = MEDS.find((m) => m.id === medId)
        if (!med) continue
        const qty = rnd() < 0.75 ? 1 : rnd() < 0.85 ? 2 : 3
        const unit = Number(med.price)
        total += unit * qty
        items.push({
          id: items.length + 1,
          product: med.id,
          medication_name: med.name,
          category: med.category,
          unit_price: money(unit),
          quantity: qty,
          line_total: money(unit * qty),
        })
      }
      if (items.length === 0) continue

      const isDebt = !isReturn && rnd() < 0.15
      const custId = isDebt ? (rnd() < 0.5 ? 1 : 2) : null
      if (isDebt && custId) debtTotals[custId] += total
      seq += 1
      sales.push({
        id: seq,
        customer: custId,
        customer_name: custId ? customers.find((c) => c.id === custId)?.name : undefined,
        payment_method: isDebt ? "debt" : "cash",
        is_return: isReturn,
        items,
        total: money(total),
        discounted_total: money(total),
        debt: isDebt ? seq : null,
        note: "",
        created_by_name: SEED_STAFF[rnd() < 0.7 ? 0 : 1],
        created_at: when.toISOString(),
        updated_at: when.toISOString(),
      })
    }
  }
  // Roughly 40% of accumulated debt is still outstanding.
  for (const c of customers) {
    const t = debtTotals[c.id]
    if (t) c.outstanding = money(t * 0.4)
  }
  return sales
}

function freshState(): DemoState {
  const customers: Customer[] = [
    { id: 1, name: "أحمد الزبون", phone: "0561000001", outstanding: "0.00" },
    { id: 2, name: "سميرة خالد", phone: "0561000002", outstanding: "45.00" },
    { id: 3, name: "زبون نقدي", phone: "", outstanding: "0.00" },
  ]
  const sales = seedSales(customers)
  return {
    meds: MEDS.map((m) => ({ ...m })),
    sales,
    customers,
    saleSeq: sales.length,
    seenUuids: {},
    cart: {},
  }
}

let createdAt = 0

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SKEY, JSON.stringify({ createdAt, state }))
  } catch {
    /* quota / private mode — the session still works in memory */
  }
}

function load(): DemoState {
  if (typeof window === "undefined") return freshState()
  try {
    const raw = window.localStorage.getItem(SKEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { createdAt?: number; state?: DemoState }
      if (parsed.createdAt && parsed.state && Date.now() - parsed.createdAt < TTL_MS) {
        createdAt = parsed.createdAt
        return parsed.state
      }
    }
  } catch {
    /* corrupted — start clean */
  }
  createdAt = Date.now()
  return freshState()
}

let state: DemoState = load()
persist()

const demoUser = {
  id: 0,
  username: "ضيف",
  email: "",
  first_name: "مستخدم",
  last_name: "تجريبي",
  display_name: "مستخدم تجريبي",
  phone: "",
  avatar: null,
  profile_image_url: "",
  is_staff: false,
  date_joined: now(),
  store: 0,
  pharmacy_name: "المودة",
  store_slug: "demo",
  pharmacy_phone: "",
  pharmacy_address: "",
  pharmacy_logo: "",
  modules: ["inventory", "pos", "customers", "debts", "reports", "sales_reports", "price_check", "imports", "purchases", "offline"],
}

function paginate<T>(rows: T[], page: number, size: number) {
  const start = (page - 1) * size
  const slice = rows.slice(start, start + size)
  return { count: rows.length, next: start + size < rows.length ? "?" : null, previous: page > 1 ? "?" : null, results: slice }
}

/* ── Router ─────────────────────────────────────────────────────────── */
export function mockFetch<T>(rawUrl: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase()
  const u = new URL(rawUrl, "https://demo.local")
  const path = u.pathname
  const q = u.searchParams
  const body = options.body ? safeJson(options.body) : {}

  const res = route(path, method, q, body)
  // Small delay so the UI feels real (spinners, optimistic states).
  return new Promise((resolve) => setTimeout(() => resolve(res as T), 90))
}

function safeJson(b: BodyInit): Record<string, unknown> {
  try {
    return typeof b === "string" ? JSON.parse(b) : {}
  } catch {
    return {}
  }
}

function route(path: string, method: string, q: URLSearchParams, body: Record<string, unknown>): Env<unknown> {
  // Auth
  if (path.endsWith("/auth/me/")) return ok(demoUser)
  if (path.endsWith("/auth/login/")) return ok({ access: "demo", refresh: "demo", user: demoUser })
  if (path.endsWith("/auth/refresh/")) return ok({ access: "demo" })
  if (path.endsWith("/auth/logout/")) return ok({})

  // POS catalogue
  if (path.endsWith("/products/pos_catalog/"))
    return ok({ count: state.meds.length, results: state.meds.map((m) => ({ id: m.id, name: m.name, barcode: m.barcode, price: m.price, stock: m.stock, category: m.category })) })

  // Medications list / filters
  if (path.endsWith("/products/") && method === "GET") {
    let rows = [...state.meds]
    const search = (q.get("search") || "").trim().toLowerCase()
    const barcode = (q.get("barcode") || "").trim()
    const category = (q.get("category") || "").trim()
    const stockState = q.get("stock_state") || ""
    if (barcode) rows = rows.filter((m) => m.barcode === barcode)
    if (search) rows = rows.filter((m) => m.name.toLowerCase().includes(search) || m.barcode.startsWith(search))
    if (category) rows = rows.filter((m) => m.category === category)
    if (stockState === "out") rows = rows.filter((m) => m.stock <= 0)
    else if (stockState === "low") rows = rows.filter((m) => m.stock > 0 && m.stock <= 5)
    else if (stockState === "in") rows = rows.filter((m) => m.stock > 5)
    const page = +(q.get("page") || "1")
    const size = +(q.get("page_size") || "30")
    return ok(paginate(rows, page, size))
  }

  // Sales
  if (path.endsWith("/sales/") && method === "POST") return ok(createSale(body), 201)
  if (path.endsWith("/sales/") && method === "GET") {
    let rows = [...state.sales].reverse()
    const pm = q.get("payment_method")
    if (pm) rows = rows.filter((s) => s.payment_method === pm)
    const isRet = q.get("is_return")
    if (isRet) rows = rows.filter((s) => Boolean(s.is_return) === (isRet === "true"))
    const minP = q.get("min_price")
    if (minP) rows = rows.filter((s) => Number(s.discounted_total) >= Number(minP))
    const maxP = q.get("max_price")
    if (maxP) rows = rows.filter((s) => Number(s.discounted_total) <= Number(maxP))
    const item = (q.get("item") || "").trim().toLowerCase()
    if (item) rows = rows.filter((s) => s.items.some((it) => it.medication_name.toLowerCase().includes(item)))
    const ca = q.get("created_after")
    if (ca) rows = rows.filter((s) => s.created_at.slice(0, 10) >= ca)
    const cb = q.get("created_before")
    if (cb) rows = rows.filter((s) => s.created_at.slice(0, 10) <= cb)
    const search = (q.get("search") || "").trim().toLowerCase()
    if (search) rows = rows.filter((s) => (s.customer_name || "").toLowerCase().includes(search))
    const page = +(q.get("page") || "1")
    const size = +(q.get("page_size") || "15")
    return ok(paginate(rows, page, size))
  }
  if (path.endsWith("/sales/stats/")) return ok(salesStats())
  const saleDel = path.match(/\/sales\/(\d+)\/$/)
  if (saleDel && method === "DELETE") {
    state.sales = state.sales.filter((s) => s.id !== +saleDel[1])
    persist()
    return ok(undefined, 204)
  }

  // Customers
  if (path.endsWith("/customers/quick/")) return ok({ count: state.customers.length, results: state.customers })
  if (path.endsWith("/customers/") && method === "GET") {
    const page = +(q.get("page") || "1")
    const size = +(q.get("page_size") || "20")
    return ok(paginate(state.customers, page, size))
  }
  if (path.endsWith("/customers/") && method === "POST") {
    const c: Customer = { id: state.customers.length + 1, name: String(body.name || "زبون"), phone: String(body.phone || ""), outstanding: "0.00" }
    state.customers.push(c)
    persist()
    return ok(c, 201)
  }

  // Cart state (per-session, in memory)
  if (path.endsWith("/pos/cart-state/") && method === "GET") return ok({ data: state.cart, updated_at: null })
  if (path.endsWith("/pos/cart-state/") && method === "PUT") {
    state.cart = (body.data as Record<string, unknown>) || {}
    persist()
    return ok({ updated_at: now() })
  }

  // Taxonomies
  if (path.endsWith("/categories/") || path.endsWith("/manufacturers/")) {
    const names = Array.from(new Set(state.meds.map((m) => m.category)))
    return ok({ count: names.length, results: names.map((n, i) => ({ id: i + 1, name: n, count: state.meds.filter((m) => m.category === n).length })) })
  }

  // Reports module (paid) — fully alive on the seeded history so the demo
  // can actually demonstrate "the reports find you money".
  if (path.endsWith("/reports/summary/")) return ok(reportsSummaryMock(+(q.get("days") || "30")))
  if (path.endsWith("/reports/teaser/")) return ok(reportsTeaserMock())
  if (path.endsWith("/reports/products/")) return ok(reportsProductsMock(q))
  if (path.endsWith("/reports/sales/summary/")) return ok(salesReportsSummaryMock(+(q.get("days") || "30")))

  // Anything else → empty-but-valid so no page crashes in the demo.
  if (method === "GET") return ok({ count: 0, results: [], periods: {}, by_category: [], daily: [] })
  return ok({})
}

function createSale(body: Record<string, unknown>): Sale {
  const uuid = String(body.client_uuid || "")
  if (uuid && state.seenUuids[uuid]) return state.seenUuids[uuid]

  const isReturn = Boolean(body.is_return)
  const payment = (body.payment_method as "cash" | "debt") || "cash"
  const rawItems = (body.items as Array<Record<string, unknown>>) || []
  let total = 0
  const items: SaleItem[] = rawItems.map((it, i) => {
    const medId = (it.product as number) ?? null
    const med = state.meds.find((m) => m.id === medId)
    const unit = Number(it.unit_price ?? med?.price ?? 0)
    const qty = Number(it.quantity ?? 1)
    total += unit * qty
    if (med) med.stock += (isReturn ? 1 : -1) * qty
    return {
      id: i + 1,
      product: medId,
      medication_name: (it.medication_name as string) || med?.name || "—",
      category: med?.category || "",
      unit_price: money(unit),
      quantity: qty,
      line_total: money(unit * qty),
    }
  })
  const discounted = body.discounted_total != null ? Number(body.discounted_total) : total
  const cust = state.customers.find((c) => c.id === (body.customer as number))
  state.saleSeq += 1
  const sale: Sale = {
    id: state.saleSeq,
    customer: (body.customer as number) ?? null,
    customer_name: cust?.name,
    payment_method: payment,
    is_return: isReturn,
    items,
    total: money(total),
    discounted_total: money(discounted),
    debt: payment === "debt" ? state.saleSeq : null,
    note: "",
    created_by_name: "مستخدم تجريبي",
    created_at: now(),
    updated_at: now(),
  }
  state.sales.push(sale)
  if (uuid) state.seenUuids[uuid] = sale
  persist()
  return sale
}

/* ── Aggregation helpers (seeded history makes these meaningful) ────── */
const saleVal = (s: Sale) => (s.is_return ? -1 : 1) * Number(s.discounted_total)
const sumSales = (arr: Sale[]) => arr.reduce((a, s) => a + saleVal(s), 0)
const dayKey = (iso: string) => iso.slice(0, 10)
const daysAgoKey = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const salesSince = (days: number) => {
  const from = daysAgoKey(days - 1)
  return state.sales.filter((s) => dayKey(s.created_at) >= from)
}
const salesBetween = (fromDaysAgo: number, toDaysAgo: number) => {
  const from = daysAgoKey(fromDaysAgo)
  const to = daysAgoKey(toDaysAgo)
  return state.sales.filter((s) => dayKey(s.created_at) >= from && dayKey(s.created_at) < to)
}

function byDaySeries(days: number): { day: string; total: string; count: number }[] {
  const map: Record<string, { total: number; count: number }> = {}
  for (let i = days - 1; i >= 0; i--) map[daysAgoKey(i)] = { total: 0, count: 0 }
  for (const s of salesSince(days)) {
    const k = dayKey(s.created_at)
    if (!map[k]) continue
    map[k].total += saleVal(s)
    map[k].count += 1
  }
  return Object.entries(map).map(([day, v]) => ({ day, total: money(v.total), count: v.count }))
}

type TopProductRow = { medication_id: number | null; name: string; quantity: string; revenue: string; sales: number }
function productAgg(days: number): TopProductRow[] {
  const map: Record<string, { id: number | null; qty: number; rev: number; n: number }> = {}
  for (const s of salesSince(days)) {
    if (s.is_return) continue
    for (const it of s.items) {
      const k = it.medication_name
      map[k] ??= { id: it.product, qty: 0, rev: 0, n: 0 }
      map[k].qty += it.quantity
      map[k].rev += Number(it.line_total)
      map[k].n += 1
    }
  }
  return Object.entries(map)
    .map(([name, v]) => ({ medication_id: v.id, name, quantity: String(v.qty), revenue: money(v.rev), sales: v.n }))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
}

function salesStats() {
  const todayArr = state.sales.filter((s) => dayKey(s.created_at) === daysAgoKey(0))
  const yesterdayArr = state.sales.filter((s) => dayKey(s.created_at) === daysAgoKey(1))
  const weekArr = salesSince(7)
  const monthArr = salesSince(30)
  const lastMonthArr = salesBetween(60, 30)
  const pack = (arr: Sale[]) => ({ amount: money(sumSales(arr)), count: arr.length })
  const cats: Record<string, number> = {}
  for (const s of monthArr)
    for (const it of s.items) cats[it.category || "أخرى"] = (cats[it.category || "أخرى"] || 0) + Number(it.line_total)
  return {
    periods: {
      today: pack(todayArr),
      yesterday: pack(yesterdayArr),
      week: pack(weekArr),
      month: pack(monthArr),
      last_month: pack(lastMonthArr),
      all_time: pack(state.sales),
    },
    by_category: Object.entries(cats).map(([category, amount]) => ({ category, amount: money(amount) })),
    daily: byDaySeries(30).map((d) => ({ date: d.day, amount: d.total, count: d.count })),
    payment_split: {
      cash: money(sumSales(monthArr.filter((s) => s.payment_method === "cash"))),
      debt: money(sumSales(monthArr.filter((s) => s.payment_method === "debt"))),
    },
  }
}

/* ── Reports module mocks (the paid module, alive in the demo) ──────── */
type IssueKey =
  | "zero_price" | "below_cost" | "zero_cost" | "negative_stock" | "out_of_stock"
  | "low_stock" | "dead_stock" | "broken_barcode" | "duplicate_barcode"
  | "no_category" | "no_name" | "name_no_letters"

const ISSUE_AR: Record<IssueKey, string> = {
  zero_price: "سعر صفر أو بالسالب",
  below_cost: "تُباع بأقل من التكلفة",
  zero_cost: "تكلفة شراء صفر أو بالسالب",
  negative_stock: "مخزون بالسالب",
  out_of_stock: "نافذ من المخزون (رصيد صفر)",
  low_stock: "مخزون منخفض (١ إلى N)",
  dead_stock: "مخزون راكد (متوفر بلا مبيعات بالفترة)",
  broken_barcode: "باركود مكسور",
  duplicate_barcode: "باركود مكرر",
  no_category: "بدون تصنيف",
  no_name: "بدون اسم",
  name_no_letters: "اسم بدون أي حروف",
}

function soldIdsSince(days: number): Set<number> {
  const ids = new Set<number>()
  for (const s of salesSince(days)) for (const it of s.items) if (it.product) ids.add(it.product)
  return ids
}

function issueFilter(issue: IssueKey | "all", lowN: number, deadDays: number): (m: Med) => boolean {
  const sold = soldIdsSince(deadDays)
  const barcodeCounts: Record<string, number> = {}
  for (const m of state.meds) if (m.barcode) barcodeCounts[m.barcode] = (barcodeCounts[m.barcode] || 0) + 1
  const fns: Record<IssueKey, (m: Med) => boolean> = {
    zero_price: (m) => Number(m.price) <= 0,
    below_cost: (m) => Number(m.cost || 0) > 0 && Number(m.price) < Number(m.cost),
    zero_cost: (m) => Number(m.cost || 0) <= 0,
    negative_stock: (m) => m.stock < 0,
    out_of_stock: (m) => m.stock === 0,
    low_stock: (m) => m.stock > 0 && m.stock <= lowN,
    dead_stock: (m) => m.stock > 0 && !sold.has(m.id),
    broken_barcode: (m) => !m.barcode || m.barcode.length < 4 || m.barcode.length > 20 || !/^\d+$/.test(m.barcode),
    duplicate_barcode: (m) => !!m.barcode && barcodeCounts[m.barcode] > 1,
    no_category: (m) => !m.category,
    no_name: (m) => !m.name.trim(),
    name_no_letters: (m) => !!m.name.trim() && !/[\p{L}]/u.test(m.name),
  }
  if (issue === "all") return () => true
  return fns[issue]
}

function reportsSummaryMock(days: number) {
  const lowN = 5
  const issues = {} as Record<IssueKey, number>
  for (const key of Object.keys(ISSUE_AR) as IssueKey[])
    issues[key] = state.meds.filter(issueFilter(key, lowN, days)).length

  const catMap: Record<string, Med[]> = {}
  for (const m of state.meds) (catMap[m.category] ??= []).push(m)
  const categories = Object.entries(catMap).map(([name, meds]) => ({
    name,
    count: meds.length,
    in_stock: meds.filter((m) => m.stock > 0).length,
    cheapest: money(Math.min(...meds.map((m) => Number(m.price)))),
    priciest: money(Math.max(...meds.map((m) => Number(m.price)))),
    stock_value: money(meds.reduce((a, m) => a + Math.max(m.stock, 0) * Number(m.cost || 0), 0)),
  }))

  const stockCost = state.meds.reduce((a, m) => a + Math.max(m.stock, 0) * Number(m.cost || 0), 0)
  const stockRetail = state.meds.reduce((a, m) => a + Math.max(m.stock, 0) * Number(m.price), 0)
  const windowSales = salesSince(days)
  const agg = productAgg(days)
  return {
    issues,
    checks: { passed: true, details: [] },
    meta: { days, dead_days: days, low_stock_threshold: lowN, generated_at: now() },
    categories,
    valuation: {
      total_medications: state.meds.length,
      in_stock: state.meds.filter((m) => m.stock > 0).length,
      stock_cost_value: money(stockCost),
      stock_retail_value: money(stockRetail),
      potential_profit: money(stockRetail - stockCost),
    },
    sales: {
      days,
      revenue: money(sumSales(windowSales)),
      count: windowSales.length,
      by_day: byDaySeries(Math.min(days, 60)),
      top_products: agg.slice(0, 5),
      least_products: agg.slice(-5).reverse(),
    },
  }
}

function reportsProductsMock(q: URLSearchParams) {
  const issue = (q.get("issue") || "all") as IssueKey | "all"
  const lowN = +(q.get("low_stock_threshold") || "5")
  const deadDays = +(q.get("dead_days") || "30")
  const page = +(q.get("page") || "1")
  const size = +(q.get("page_size") || "30")
  const search = (q.get("search") || "").trim().toLowerCase()
  let rows = state.meds.filter(issueFilter(issue, lowN, deadDays))
  if (search) rows = rows.filter((m) => m.name.toLowerCase().includes(search) || m.barcode.includes(search))
  const start = (page - 1) * size
  return {
    issue,
    label: issue === "all" ? "الكل" : ISSUE_AR[issue],
    count: rows.length,
    page,
    page_size: size,
    results: rows.slice(start, start + size).map((m) => ({
      id: m.id,
      name: m.name,
      barcode: m.barcode,
      category: m.category,
      price: m.price,
      cost: m.cost || "0.00",
      stock: String(m.stock),
    })),
  }
}

function salesReportsSummaryMock(days: number) {
  const windowSales = salesSince(days)
  const returns = windowSales.filter((s) => s.is_return)
  const revenue = sumSales(windowSales)
  const byHour: Record<number, { total: number; count: number }> = {}
  const byEmp: Record<string, { total: number; count: number }> = {}
  const byCat: Record<string, { revenue: number; qty: number }> = {}
  const byCust: Record<string, { total: number; count: number }> = {}
  for (const s of windowSales) {
    const h = new Date(s.created_at).getHours()
    byHour[h] = { total: (byHour[h]?.total || 0) + saleVal(s), count: (byHour[h]?.count || 0) + 1 }
    const e = s.created_by_name || "—"
    byEmp[e] = { total: (byEmp[e]?.total || 0) + saleVal(s), count: (byEmp[e]?.count || 0) + 1 }
    if (s.customer_name)
      byCust[s.customer_name] = { total: (byCust[s.customer_name]?.total || 0) + saleVal(s), count: (byCust[s.customer_name]?.count || 0) + 1 }
    for (const it of s.items) {
      byCat[it.category || "أخرى"] = {
        revenue: (byCat[it.category || "أخرى"]?.revenue || 0) + Number(it.line_total),
        qty: (byCat[it.category || "أخرى"]?.qty || 0) + it.quantity,
      }
    }
  }
  const agg = productAgg(days)
  return {
    days,
    revenue: money(revenue),
    count: windowSales.length,
    avg_basket: money(windowSales.length ? revenue / windowSales.length : 0),
    returns: { count: returns.length, value: money(returns.reduce((a, s) => a + Number(s.discounted_total), 0)) },
    payment_split: {
      cash: money(sumSales(windowSales.filter((s) => s.payment_method === "cash"))),
      debt: money(sumSales(windowSales.filter((s) => s.payment_method === "debt"))),
    },
    by_day: byDaySeries(Math.min(days, 60)),
    by_hour: Array.from({ length: 24 }, (_, h) => ({ hour: h, total: money(byHour[h]?.total || 0), count: byHour[h]?.count || 0 })),
    by_employee: Object.entries(byEmp).map(([name, v]) => ({ name, total: money(v.total), count: v.count })),
    by_category: Object.entries(byCat).map(([name, v]) => ({ name, revenue: money(v.revenue), qty: String(v.qty) })),
    top_customers: Object.entries(byCust).map(([name, v]) => ({ name, total: money(v.total), count: v.count })),
    top_products: agg.slice(0, 5),
    least_products: agg.slice(-5).reverse(),
  }
}

function reportsTeaserMock() {
  const agg = productAgg(30)
  return {
    zero_price: state.meds.filter((m) => Number(m.price) <= 0).length,
    below_cost: state.meds.filter((m) => Number(m.cost || 0) > 0 && Number(m.price) < Number(m.cost)).length,
    negative_stock: state.meds.filter((m) => m.stock < 0).length,
    top_product: agg[0]?.name || "—",
  }
}
