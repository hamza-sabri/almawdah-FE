"use client"

import { useQuery } from "@tanstack/react-query"
import { customFetch } from "@/api/http"

export type MedStats = {
  total_items: number
  in_stock: number
  low_stock?: number
  out_of_stock: number
  total_units: number
  retail_value: string
  cost_value: string
  by_category: { category: string; count: number }[]
  /** How the catalogue is packaged — drives the "الوحدات" filter counts.
   *  Optional: a backend deployed before this field still answers. */
  units?: { pack: number; variant: number; plain: number }
}

/** Catalogue KPIs from GET /api/v1/products/stats/. */
export function useMedStats() {
  return useQuery({
    queryKey: ["products", "stats"],
    queryFn: async () => {
      const res = await customFetch<{ data: MedStats }>(
        "/api/v1/products/stats/",
      )
      return res.data
    },
    staleTime: 60_000,
  })
}
