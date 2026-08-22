"use client"

import { useQuery } from "@tanstack/react-query"

type PageBody<T> = {
  count: number
  next?: string | null
  previous?: string | null
  results: T[]
}

/** The generated orval "fetch" functions resolve to a { data } envelope. */
type ListResponse<T> = { data: PageBody<T> }

/** Shallow-equal on the filter object that identifies the query. */
function sameParams(a: unknown, b: Record<string, unknown>): boolean {
  if (!a || typeof a !== "object") return false
  const x = a as Record<string, unknown>
  const ka = Object.keys(x)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return kb.every((k) => x[k] === b[k])
}

/**
 * Classic page-number pagination over a generated `xxxList` fetcher.
 * Keeps the previous page visible while the next one loads (no flc/flicker),
 * and returns the total `count` + derived `pageCount`.
 */
export function usePagedList<T>(
  keyBase: readonly unknown[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetcher: (params: any) => Promise<ListResponse<T>>,
  params: Record<string, unknown>,
  page: number,
  pageSize: number,
  enabled = true,
) {
  const queryKey = [...keyBase, "paged", params, page]

  const query = useQuery({
    queryKey,
    queryFn: () => fetcher({ ...params, page, page_size: pageSize }),
    enabled,
    // keepPreviousData, but ONLY across a page change of the SAME query.
    //
    // Plain `keepPreviousData` also holds the previous rows when the FILTER
    // changes, and on /customers/[id] the filter is `{ customer: id }` — so
    // walking from one customer to the next showed the previous customer's
    // debts under the new customer's name, and a customer with none left the
    // page looking like the customer before them. Money on the wrong person's
    // screen is worse than a spinner.
    placeholderData: (prev, prevQuery) => {
      const prevParams = prevQuery?.queryKey?.[keyBase.length + 1]
      return sameParams(prevParams, params) ? prev : undefined
    },
  })

  const results = query.data?.data.results ?? []
  const count = query.data?.data.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / pageSize))

  return { ...query, results, count, pageCount }
}
