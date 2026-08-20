"use client"

import { customFetch } from "@/api/http"

/** Hand-rolled client for the sales endpoints (not yet in the orval schema). */

export type SaleItem = {
  id?: number
  product?: number | null
  variant?: number | null
  medication_name?: string
  variant_label?: string
  category?: string
  unit_price: string
  /**
   * The catalogue price at the moment of sale, when the cashier overrode it at
   * the till. NULL/absent means unit_price WAS the catalogue price.
   * Backend: SaleItem.original_unit_price.
   */
  original_unit_price?: string | null
  quantity: number
  line_total?: string
}

export function saleItemName(it: {
  medication_name?: string
  variant_label?: string
}): string {
  const base = it.medication_name || "—"
  return it.variant_label ? `${base} — ${it.variant_label}` : base
}

export type Sale = {
  id: number
  customer: number | null
  customer_name?: string
  customer_phone?: string
  payment_method: "cash" | "debt"
  is_return?: boolean
  items: SaleItem[]
  total: string
  discounted_total: string
  debt: number | null
  note: string
  /** The 12-digit number printed as a barcode on this sale's receipt. */
  receipt_code?: string
  created_by?: number | null
  created_by_name?: string
  /** How many earlier versions this sale has. 0 = never corrected. */
  revision_count?: number
  created_at: string
  updated_at: string
}

/** One past version of a sale, kept whole. Backend: SaleRevision. */
export type SaleRevision = {
  id: number
  /** 1 is the sale as it was originally rung. */
  version: number
  edited_at: string
  edited_by: string
  snapshot: {
    total: string
    discounted_total: string
    payment_method: "cash" | "debt"
    is_return: boolean
    customer_name: string
    note: string
    receipt_code: string
    created_at: string | null
    items: Array<{
      product_id: number | null
      variant_id: number | null
      medication_name: string
      variant_label: string
      quantity: string
      unit_price: string
      line_total: string
    }>
  }
}

export type SalePayload = {
  customer?: number | null
  payment_method: "cash" | "debt"
  is_return?: boolean
  items: Array<{
    product?: number | null
    variant?: number | null
    medication_name?: string
    unit_price?: string
    /** The catalogue price, when the cashier overrode it at the till. */
    original_unit_price?: string
    quantity: number
  }>
  discounted_total?: string
  note?: string
  /**
   * The number printed as a barcode on the receipt (12 digits, YYMMDD + 6).
   * Minted on the till so an offline receipt stays findable after it syncs;
   * the server replaces it only if it is malformed or already used.
   * Backend: Sale.receipt_code.
   */
  receipt_code?: string
  /**
   * Idempotency key for offline sync: a client-generated UUID. Re-sending the
   * same key returns the original sale instead of creating a duplicate, so a
   * queued offline checkout can be retried safely. Backend: Sale.client_uuid.
   */
  client_uuid?: string
}

type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }

export type PeriodBucket = { amount: string | number; count: number }

export type SalesStats = {
  periods: {
    today: PeriodBucket
    yesterday: PeriodBucket
    week: PeriodBucket
    month: PeriodBucket
    last_month: PeriodBucket
    all_time: PeriodBucket
  }
  by_category: {
    category: string
    amount: string | number
    /** Units sold in this category (returns count negative). */
    qty?: string | number
  }[]
  daily: { date: string; amount: string | number; count: number }[]
  payment_split: { cash: string | number; debt: string | number }
}

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ""
}

export const salesList = (params: Record<string, unknown>) =>
  customFetch<{ data: Page<Sale> }>(`/api/v1/sales/${qs(params)}`)

export const salesCreate = (body: SalePayload) =>
  customFetch<{ data: Sale }>(`/api/v1/sales/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const salesGet = (id: number) =>
  customFetch<{ data: Sale }>(`/api/v1/sales/${id}/`)

/**
 * Correct a sale in place.
 *
 * PATCH, not POST: the sale keeps its id, its receipt number and its place in
 * the day, so the paper already in the customer's hand still finds it. The
 * server files the whole previous version away first — see salesRevisions.
 *
 * `items` is a full replacement, not a merge: send every line the corrected
 * sale should have. Sending none is refused rather than emptying the invoice.
 */
export const salesUpdate = (id: number, body: SalePayload) =>
  customFetch<{ data: Sale }>(`/api/v1/sales/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

/**
 * Put a sale back the way it was in one of its earlier versions.
 *
 * Server-side on purpose: a restore is an EDIT, so it runs the same path a
 * PATCH does — the version it replaces is filed away first, stock moves by the
 * difference, and the debt is rebuilt. The server is also the only side that
 * knows which of the products in that old version still exist.
 */
export const salesRestoreRevision = (id: number, version: number) =>
  customFetch<{ data: Sale }>(
    `/api/v1/sales/${id}/revisions/${version}/restore/`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  )

/** Every previous version of a sale, newest first. */
export const salesRevisions = (id: number) =>
  customFetch<{ data: { results: SaleRevision[] } }>(
    `/api/v1/sales/${id}/revisions/`,
  )

export const salesDelete = (id: number) =>
  customFetch<void>(`/api/v1/sales/${id}/`, { method: "DELETE" })

/**
 * Takings for the CURRENT trading day — which does not begin at midnight.
 *
 * The shop is still selling at 1am and cashes up in the morning, so the
 * rollover hour lives on the server (BUSINESS_DAY_START_HOUR, default 4) and
 * is applied in the shop's own timezone. The client must not compute this
 * itself: a till whose clock or timezone is off would quietly report a
 * different day than the owner's books.
 */
export type DaySummary = {
  day_start: string
  day_end: string
  cutover_hour: number
  total: { amount: string; count: number }
  groups: Array<{
    key: string
    label: string
    amount: string
    count: number
    /**
     * The name pattern the SERVER used to pick these lines.
     *
     * Sent so the till can apply the same rule to sales still sitting in its
     * offline queue, instead of keeping its own copy of the words — which
     * would drift the first time the shop stocks a brand neither side knew
     * about. See lib/offline/reads.ts.
     */
    match?: string
  }>
}

export const salesDaySummary = () =>
  customFetch<{ data: DaySummary }>(`/api/v1/sales/day_summary/`)

export const salesStats = () =>
  customFetch<{ data: SalesStats }>(`/api/v1/sales/stats/`)

/** Compact whole-catalogue payload for instant client-side barcode lookups. */
export type CatalogVariant = {
  id: number
  label: string
  barcode: string
  price: string | number
  stock: number
  attributes?: Record<string, unknown>
  /** Pieces inside the box. null/0 = a plain variant (colour, flavour), not a
   *  pack. Carried offline so /inventory's "له عبوة" filter works with no
   *  network. */
  pack_size?: string | number | null
}

export type CatalogMed = {
  id: number
  name: string
  barcode: string
  /** Unit/packaging barcodes — same product, same stock & price. */
  alt_barcodes?: string[]
  price: string | number
  stock: number
  category: string
  variants?: CatalogVariant[]
}

/** Cheap catalogue fingerprint — poll it; refetch pos_catalog on change. */
export const catalogVersion = () =>
  customFetch<{ data: { version: string } }>(
    `/api/v1/products/catalog_version/`,
  )

export const posCatalog = () =>
  customFetch<{ data: { count: number; results: CatalogMed[] } }>(
    `/api/v1/products/pos_catalog/`,
  )

/** All customers in one Redis-cached call (instant client-side search). */
export type QuickCustomer = {
  id: number
  name: string
  phone: string
  outstanding: string
}

export const customersQuick = () =>
  customFetch<{ data: { count: number; results: QuickCustomer[] } }>(
    `/api/v1/customers/quick/`,
  )

/** Bulk collection: no amount = settle everything; amount = oldest-first. */
export const customerSettle = (id: number, amount?: string) =>
  customFetch<{
    data: { settled_count: number; collected: string; outstanding: string }
  }>(`/api/v1/customers/${id}/settle/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(amount ? { amount } : {}),
  })

/** Per-account POS carts (start a sale on one device, finish on another). */
export const cartStateGet = () =>
  customFetch<{ data: { data: Record<string, unknown>; updated_at: string | null } }>(
    `/api/v1/pos/cart-state/`,
  )

export const cartStatePut = (data: Record<string, unknown>) =>
  customFetch<{ data: { updated_at: string } }>(`/api/v1/pos/cart-state/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  })

/** Category / manufacturer rows feeding the searchable dropdowns. */
export type TaxonomyRow = { id: number; name: string; count: number }

export const taxonomyList = (
  kind: "categories" | "manufacturers",
  search = "",
) =>
  customFetch<{ data: { count: number; results: TaxonomyRow[] } }>(
    `/api/v1/${kind}/?page_size=50${search ? `&search=${encodeURIComponent(search)}` : ""}`,
  )
