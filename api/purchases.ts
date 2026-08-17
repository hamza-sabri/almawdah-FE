"use client"

import { customFetch } from "@/api/http"

export type PurchaseItem = {
  id?: number
  medication_id: number | null
  medication_name: string
  barcode: string
  quantity: string
  unit_cost: string
  line_total?: string
}

export type PurchaseOrder = {
  id: number
  supplier: string
  status: "draft" | "received"
  note: string
  total_cost: string
  received_at: string | null
  created_by_name: string
  created_at: string
  items: PurchaseItem[]
}

type Paginated<T> = { count: number; results: T[] }

const call = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await customFetch<{ data: T }>(url, options)
  return res.data
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export const purchaseOrdersList = () =>
  call<Paginated<PurchaseOrder> | PurchaseOrder[]>("/api/v1/purchase-orders/").then(
    (d) => (Array.isArray(d) ? d : d.results),
  )

export const purchaseOrderCreate = (body: {
  supplier?: string
  note?: string
  items: Omit<PurchaseItem, "id" | "line_total">[]
}) => call<PurchaseOrder>("/api/v1/purchase-orders/", jsonInit("POST", body))

export const purchaseOrderReceive = (id: number) =>
  call<PurchaseOrder>(`/api/v1/purchase-orders/${id}/receive/`, jsonInit("POST", {}))

export const purchaseOrderDelete = (id: number) =>
  customFetch(`/api/v1/purchase-orders/${id}/`, { method: "DELETE" })
