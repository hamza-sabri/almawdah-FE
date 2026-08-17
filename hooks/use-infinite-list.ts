"use client"

import { useInfiniteQuery } from "@tanstack/react-query"

type PageBody<T> = {
  count: number
  next?: string | null
  previous?: string | null
  results: T[]
}

/** The generated orval "fetch" functions resolve to a { data } envelope. */
type ListResponse<T> = { data: PageBody<T> }

/** Pull the `page` number out of DRF's `next` URL (or undefined at the end). */
function nextPageParam(url?: string | null): number | undefined {
  if (!url) return undefined
  try {
    const p = new URL(url).searchParams.get("page")
    return p ? Number(p) : undefined
  } catch {
    return undefined
  }
}

/**
 * Server-paginated list over a generated `xxxList` fetcher. Flattens every page
 * into `items` and exposes `count` + the usual infinite-query controls.
 */
export function useInfiniteList<T>(
  keyBase: readonly unknown[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetcher: (params: any) => Promise<ListResponse<T>>,
  params: Record<string, unknown>,
  enabled = true,
) {
  const query = useInfiniteQuery({
    queryKey: [...keyBase, params],
    queryFn: ({ pageParam }) => fetcher({ ...params, page: pageParam }),
    initialPageParam: 1 as number,
    getNextPageParam: (last) => nextPageParam(last.data.next),
    enabled,
  })

  const items = query.data?.pages.flatMap((p) => p.data.results ?? []) ?? []
  const count = query.data?.pages[0]?.data.count ?? 0

  return { ...query, items, count }
}
