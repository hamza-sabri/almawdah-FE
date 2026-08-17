"use client"

import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { customersQuick } from "@/api/sales"
import { customersList } from "@/api/generated/customers/customers"
import type { ComboOption } from "@/components/entity-combobox"

/**
 * Customers held client-side (server side is Redis-cached, invalidated on any
 * customer/debt change) so the POS customer picker filters instantly.
 * Falls back to the paginated API until the catalogue has loaded.
 */
export function useCustomersCatalog() {
  const { data } = useQuery({
    queryKey: ["customers-quick"],
    queryFn: async () => (await customersQuick()).data.results,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const fetcher = useCallback(
    async (search: string): Promise<ComboOption[]> => {
      if (data) {
        const q = search.trim().toLowerCase()
        const hits = q
          ? data.filter(
              (c) =>
                c.name.toLowerCase().includes(q) || (c.phone || "").includes(q),
            )
          : data
        return hits.slice(0, 20).map((c) => ({
          id: c.id,
          label: c.name,
          sub: c.phone || undefined,
        }))
      }
      // Catalogue still loading → hit the API once.
      const r = await customersList({ search: search || undefined, page_size: 20 })
      return (r.data.results ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        sub: c.phone || undefined,
      }))
    },
    [data],
  )

  return { customers: data, fetcher, ready: Boolean(data) }
}
