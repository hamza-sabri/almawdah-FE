"use client"

import { useEffect } from "react"

import { useMe } from "@/hooks/use-me"
import { getPharmacySlug, isCentral, pharmacyPosUrl } from "@/lib/site"
import { getAccessToken, getRefreshToken, clearTokens } from "@/lib/tokens"

export function TenantGuard() {
  const { user } = useMe()
  useEffect(() => {
    if (isCentral() || !user) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) return
    const currentSlug = getPharmacySlug()
    const userSlug = (user as { store_slug?: string }).store_slug
    if (!currentSlug || !userSlug || userSlug === currentSlug) return
    const access = getAccessToken()
    const refresh = getRefreshToken()
    clearTokens()
    if (access && refresh) {
      window.location.assign(pharmacyPosUrl(userSlug, { access, refresh }))
    }
  }, [user])
  return null
}
