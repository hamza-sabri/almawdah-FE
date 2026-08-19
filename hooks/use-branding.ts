"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  DEFAULT_BRAND_NAME,
  fetchBranding,
  type Branding,
} from "@/lib/branding"

const LS_KEY = "pharma_branding_v1"

function readCached(): Branding | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Branding) : null
  } catch {
    return null
  }
}

/**
 * This deployment's store branding, with the generic Pharma brand as the
 * fallback. Mirrored to localStorage so the POS shows the right name/logo
 * instantly on reload and while offline (same offline-first spirit as the
 * rest of the app).
 */
export function useBranding() {
  /**
   * The server has no localStorage, so `initialData` below resolves to
   * undefined there and to the cached branding here — server rendered
   * "المودة", the browser rendered "سوبر ماركت المودة", and React threw a
   * hydration mismatch and re-rendered the tree.
   *
   * So: everyone shows the default for the first paint, and the real name
   * appears immediately after mount. One extra frame, no mismatch.
   */
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const { data } = useQuery<Branding | null>({
    queryKey: ["public-branding"],
    queryFn: async () => {
      const branding = await fetchBranding()
      try {
        if (branding) {
          window.localStorage.setItem(LS_KEY, JSON.stringify(branding))
        } else {
          window.localStorage.removeItem(LS_KEY)
        }
      } catch {
        // Private mode / quota — cosmetic cache only.
      }
      return branding
    },
    // undefined (not null) when nothing is cached — otherwise the query would
    // be born "fresh" and never do its first fetch.
    initialData: () => readCached() ?? undefined,
    // Treat the localStorage copy as OLD so the query always revalidates on
    // load. Without this, re-seeding initialData each mount marked the data
    // "fresh now" and — with the old 1h staleTime — it effectively never
    // refetched, so a changed name/logo never appeared (had to wipe storage).
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  })

  const branding = hydrated ? data : undefined
  return {
    /** Store name, or the deployment default when unknown. */
    name: branding?.name?.trim() || DEFAULT_BRAND_NAME,
    /** Store logo URL, or "" when the tenant has none (use the default mark). */
    logo: branding?.logo || "",
  }
}
