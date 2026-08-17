"use client"

import { useAuthMeRetrieve } from "@/api/generated/auth/auth"
import type { User } from "@/api/generated/model"

/** Current authenticated staff user (from GET /auth/me/). */
export function useMe(enabled = true) {
  const query = useAuthMeRetrieve({
    query: {
      enabled,
      staleTime: 5 * 60_000,
      retry: false,
    },
  })

  const user = (query.data?.data as User | undefined) ?? undefined
  return { user, ...query }
}

export function displayName(user?: User): string {
  if (!user) return ""
  return (
    user.display_name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username
  )
}
