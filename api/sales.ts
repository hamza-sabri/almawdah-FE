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
  created_by?: number | null
  created_by_name?: string
  created_at: string
  updated_at: string
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
    quantity: number
  }>
  discounted_total?: string
  note?: string
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

export const salesDelete = (id: number) =>
  customFetch<void>(`/api/v1/sales/${id}/`, { method: "DELETE" })

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
