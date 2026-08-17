"use client"

import { customFetch } from "@/api/http"

export type Variant = {
  id: number
  product: number
  label: string
  barcode: string
  price: string
  cost: string
  stock: string
  is_active: boolean
  attributes?: Record<string, unknown>
  image?: string
}

export type VariantInput = {
  product: number
  label: string
  barcode?: string
  price: string
  cost?: string
  stock?: string
  is_active?: boolean
  attributes?: Record<string, string>
}

export const listVariants = (medicationId: number) =>
  customFetch<{ data: { count: number; results: Variant[] } }>(
    `/api/v1/variants/?product=${medicationId}&page_size=100&ordering=label`,
  )

export const createVariant = (body: VariantInput) =>
  customFetch<{ data: Variant }>(`/api/v1/variants/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const updateVariant = (id: number, body: Partial<VariantInput>) =>
  customFetch<{ data: Variant }>(`/api/v1/variants/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const deleteVariant = (id: number) =>
  customFetch<{ data: unknown }>(`/api/v1/variants/${id}/`, {
    method: "DELETE",
  })
