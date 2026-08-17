"use client"

import { API_BASE, customFetch } from "@/api/http"
import { getAccessToken } from "@/lib/tokens"

/** Download all products in Hesabate's «قائمة الأسعار» column schema (xlsx). */
export async function downloadHesabateProducts(): Promise<void> {
  const headers = new Headers()
  const token = getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const res = await fetch(`${API_BASE}/api/v1/products/export/hesabate/`, {
    headers,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = "hesabate-products.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

/** Fields a bulk edit can set. `price_from_cost_margin` derives the price from
 *  each product's own cost (e.g. 25 → cost × 1.25) — the zero-price repair. */
export type BulkChanges = {
  price?: string
  cost?: string
  stock?: string
  category?: string
  manufacturer?: string
  brand?: string
  expiry_date?: string | null
  expiry_alert_days?: number
  reorder_level?: string
  price_from_cost_margin?: number
}

/** Bulk-edit products: an explicit selection, or EVERY row matching a report
 *  filter (pass the same filter params the reports table uses). Owner-only. */
export const bulkUpdateMedications = (body: {
  ids?: number[]
  all_matching?: boolean
  issue?: string
  search?: string
  category_filter?: string
  manufacturer_filter?: string
  price_min?: string
  price_max?: string
  stock_min?: string
  stock_max?: string
  low_stock_threshold?: number
  dead_days?: number
  include_equal?: 1 | 0
  name_min?: number
  name_max?: number
  changes: BulkChanges
}) =>
  customFetch<{
    data: {
      updated: number
      audit_id: number
      can_undo: boolean
      priced_from_cost?: number
    }
  }>(`/api/v1/products/bulk_update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

/** Put a logged bulk action back — restores each row's previous values. */
export const undoAudit = (id: number) =>
  customFetch<{ data: { restored: number } }>(`/api/v1/audit/${id}/undo/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })

/** Recent destructive actions (owner-only). */
export type AuditEntry = {
  id: number
  action: string
  action_label: string
  summary: string
  affected: number
  actor: string
  created_at: string
  undone_at: string | null
  can_undo: boolean
}

export const auditLog = () =>
  customFetch<{ data: { results: AuditEntry[] } }>(`/api/v1/audit/`)

export const bulkDeleteMedications = (body: { ids?: number[]; all?: boolean }) =>
  customFetch<{ data: { deleted: number } }>(`/api/v1/products/bulk_delete/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const bulkDeleteSales = (body: { ids?: number[]; all?: boolean }) =>
  customFetch<{ data: { deleted: number } }>(`/api/v1/sales/bulk_delete/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const seedDemoMedications = () =>
  customFetch<{
    data: { source: string; created: number; skipped: number; variants: number }
  }>(`/api/v1/products/seed_demo/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
