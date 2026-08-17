"use client"

import { API_BASE, customFetch } from "@/api/http"
import { getAccessToken } from "@/lib/tokens"

/** Hand-rolled client for the paid reports module (not in the orval schema). */

export type ReportIssueKey =
  | "zero_price"
  | "below_cost"
  | "zero_cost"
  | "negative_stock"
  | "out_of_stock"
  | "low_stock"
  | "dead_stock"
  | "expired"
  | "expiring_soon"
  | "no_expiry"
  | "broken_barcode"
  | "duplicate_barcode"
  | "no_category"
  | "no_name"
  | "name_no_letters"
  | "name_length"

/** Mirrors apps/store/reports.py ISSUES. */
export const ISSUE_LABELS: Record<ReportIssueKey, string> = {
  zero_price: "سعر صفر أو بالسالب",
  below_cost: "تُباع بأقل من التكلفة",
  zero_cost: "تكلفة شراء صفر أو بالسالب",
  negative_stock: "مخزون بالسالب",
  out_of_stock: "نافذ من المخزون (رصيد صفر)",
  low_stock: "مخزون منخفض (١ إلى N)",
  dead_stock: "مخزون راكد (متوفر بلا مبيعات بالفترة)",
  expired: "منتهي الصلاحية",
  expiring_soon: "قريب الانتهاء",
  no_expiry: "بدون تاريخ صلاحية",
  broken_barcode: "باركود مكسور",
  duplicate_barcode: "باركود مكرر",
  no_category: "بدون تصنيف",
  no_name: "بدون اسم",
  name_no_letters: "اسم بدون أي حروف",
  name_length: "اسم قصير جداً أو طويل جداً",
}

/** Why a barcode counts as broken — mirrors apps/store/reports.py
 *  (aligned with the scanner's accept rule: digits, 4–20 chars). */
export function barcodeProblem(barcode: string): string {
  if (!barcode) return "بدون باركود"
  const problems: string[] = []
  if (barcode.length < 4) problems.push("أقصر من ٤ خانات")
  if (barcode.length > 20) problems.push("أطول من ٢٠ خانة")
  if (!/^\d+$/.test(barcode)) problems.push("يحتوي رموزاً غير رقمية")
  return problems.join(" · ")
}

export type CategoryBreakdown = {
  name: string
  count: number
  in_stock: number
  cheapest: string
  priciest: string
  stock_value: string
}

/** Real-but-limited numbers for the upsell teaser — open to all staff. */
export type ReportsTeaserData = {
  zero_price: number
  below_cost: number
  negative_stock: number
  top_product: string
}

export type TopProduct = {
  medication_id: number | null
  name: string
  quantity: string
  revenue: string
  sales: number
}

export type SummaryCheck = {
  name: string
  label: string
  actual: number
  expected: number
  ok: boolean
}

export type ReportsSummary = {
  issues: Record<ReportIssueKey, number>
  /** Server-side self-verification — when passed=false, show a warning. */
  checks?: { passed: boolean; details: SummaryCheck[] }
  meta?: {
    days: number
    dead_days: number
    low_stock_threshold: number
    generated_at: string
  }
  categories: CategoryBreakdown[]
  valuation: {
    total_medications: number
    in_stock: number
    stock_cost_value: string
    stock_retail_value: string
    potential_profit: string
  }
  sales: {
    days: number
    revenue: string
    count: number
    by_day: { day: string; total: string; count: number }[]
    top_products: TopProduct[]
    least_products: TopProduct[]
  }
}

export type ReportProductsPage = {
  issue: ReportIssueKey
  label: string
  count: number
  page: number
  page_size: number
  results: {
    id: number
    name: string
    barcode: string
    category: string
    price: string
    cost: string
    stock: string
  }[]
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ""
}

/** customFetch returns an orval-style {status, data} envelope — unwrap it. */
const get = async <T>(url: string): Promise<T> => {
  const res = await customFetch<{ status: number; data: T }>(url)
  return res.data
}

export const reportsSummary = (days = 30) =>
  get<ReportsSummary>(`/api/v1/reports/summary/${qs({ days })}`)

export const reportsTeaser = () =>
  get<ReportsTeaserData>("/api/v1/reports/teaser/")

export const reportsProducts = (params: {
  /** An issue key, or "all" to filter against the entire catalogue. */
  issue: ReportIssueKey | "all"
  search?: string
  page?: number
  page_size?: number
  /** name | -name | price | -price | stock | -stock | cost | -cost */
  ordering?: string
  /** Owner-controlled N for low_stock. */
  low_stock_threshold?: number
  dead_days?: number
  /** below_cost: also match price EQUAL to cost. */
  include_equal?: 1 | 0
  /** Advanced ranges — combine with the quick filter or the "all" scope. */
  price_min?: string
  price_max?: string
  stock_min?: string
  stock_max?: string
  category?: string
  /** Company / manufacturer name (contains-match). */
  manufacturer?: string
  /** name_length: the sensible-name character window (owner-tunable). */
  name_min?: number
  name_max?: number
}) => get<ReportProductsPage>(`/api/v1/reports/products/${qs(params)}`)

/** Valuation + category breakdown over the ACTIVE filter (charts track it). */
export type ReportsFilteredCharts = {
  valuation: ReportsSummary["valuation"]
  categories: CategoryBreakdown[]
}

export const reportsFilteredCharts = (params: {
  issue: ReportIssueKey | "all"
  search?: string
  low_stock_threshold?: number
  dead_days?: number
  include_equal?: 1 | 0
  price_min?: string
  price_max?: string
  stock_min?: string
  stock_max?: string
  category?: string
  manufacturer?: string
  name_min?: number
  name_max?: number
}) =>
  get<ReportsFilteredCharts>(
    `/api/v1/reports/filtered-charts/${qs(params)}`,
  )

/** Deep sales analytics — its own paid module ("sales_reports"). */
export type SalesReportsSummary = {
  days: number
  revenue: string
  count: number
  avg_basket: string
  returns: { count: number; value: string }
  payment_split: { cash: string; debt: string }
  by_day: { day: string; total: string; count: number }[]
  by_hour: { hour: number; total: string; count: number }[]
  by_employee: { name: string; total: string; count: number }[]
  by_category: { name: string; revenue: string; qty: string }[]
  top_customers: { name: string; total: string; count: number }[]
  top_products: TopProduct[]
  least_products: TopProduct[]
}

export const salesReportsSummary = (days = 30) =>
  get<SalesReportsSummary>(`/api/v1/reports/sales/summary/${qs({ days })}`)

export const downloadSalesReport = async (days: number) => {
  const url = await fetchBlobUrl(`/api/v1/reports/sales/export/${qs({ days })}`)
  const a = document.createElement("a")
  a.href = url
  a.download = "report-sales.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

export const reportsTopProducts = (params: {
  days?: number
  by?: "qty" | "revenue"
  direction?: "top" | "bottom"
  limit?: number
}) => get<{ results: TopProduct[] }>(`/api/v1/reports/top-products/${qs(params)}`)

/** Authorized binary GET → object URL (xlsx exports, the QR PNG). */
async function fetchBlobUrl(path: string): Promise<string> {
  const headers = new Headers()
  const token = getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const res = await fetch(API_BASE + path, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return URL.createObjectURL(await res.blob())
}

export async function downloadReport(
  params: Record<string, string | number | undefined>,
  filename: string,
) {
  const url = await fetchBlobUrl(`/api/v1/reports/export/${qs(params)}`)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const priceQrUrl = () => fetchBlobUrl("/api/v1/qr/price-page/")

/** Purchase quota — what to restock, rough buy cost, projected gain. */
export type RestockRow = {
  medication_id: number
  name: string
  barcode: string
  category: string
  manufacturer: string
  stock: string
  reorder_level: string
  cost: string
  price: string
  sold: string
  suggested_qty: string
  buy_cost: string
  projected_gain: string
}
export type RestockQuota = {
  days: number
  cover_days: number
  low_stock_threshold: string
  count: number
  total_buy_cost: string
  total_projected_gain: string
  results: RestockRow[]
}
export const restockQuota = (
  params: { days?: number; cover_days?: number; low_stock_threshold?: number } = {},
) => get<RestockQuota>(`/api/v1/reports/restock-quota/${qs(params)}`)

/** Price-check scan analytics — its own paid module ("scan_reports"). One row
 *  per scanned barcode over the window; matched rows carry current price/stock
 *  so the owner can reprice/reorder, and not-found rows are demand signals. */
export type ScanProduct = {
  barcode: string
  name: string
  medication_id: number | null
  found: boolean
  count: number
  days: number
  last_day: string | null
  price: string | null
  cost: string | null
  stock: string | null
}
export type ScansReport = {
  days: number
  from: string
  to: string
  summary: {
    total_scans: number
    matched_scans: number
    not_found_scans: number
    distinct_barcodes: number
    matched_barcodes: number
    not_found_barcodes: number
    matched_rate: string
  }
  by_day: { day: string; total: number; matched: number; not_found: number }[]
  products: ScanProduct[]
}
export const reportsScans = (days = 30) =>
  get<ScansReport>(`/api/v1/reports/scans/${qs({ days })}`)

/** Owner: wipe ALL price-scan analytics for the store (DB rows + Redis
 *  counters + cached payloads). */
export const clearScans = () =>
  customFetch<{ status: number; data: { deleted: number } }>(
    "/api/v1/reports/scans/",
    { method: "DELETE" },
  )
