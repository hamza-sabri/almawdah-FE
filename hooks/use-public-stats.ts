"use client"

import { useQuery } from "@tanstack/react-query"
import { publicStats } from "@/api/public"

/** Live platform stats for the marketing pages (cached server-side too). */
export function usePublicStats() {
  return useQuery({
    queryKey: ["public-stats"],
    queryFn: publicStats,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
