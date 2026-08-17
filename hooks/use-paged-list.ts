"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

type PageBody<T> = {
  count: number
  next?: string | null
  previous?: string | null
  results: T[]
}

/** The generated orval "fetch" functions resolve to a { data } envelope. */
type ListResponse<T> = { data: PageBody<T> }

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
  const query = useQuery({
    queryKey: [...keyBase, "paged", params, page],
    queryFn: () => fetcher({ ...params, page, page_size: pageSize }),
    enabled,
    placeholderData: keepPreviousData,
  })

  const results = query.data?.data.results ?? []
  const count = query.data?.data.count ?? 0
  const pageCount = Math.max(1, Math.ceil(count / pageSize))

  return { ...query, results, count, pageCount }
}
